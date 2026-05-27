// ninjacore-r2 — fast R2 fronting Worker.
//
// Goals (where the real speedups live):
//   1. Cache API hits — repeat reads of the same object never touch R2.
//   2. Conditional GET — honor If-None-Match / If-Modified-Since → 304s.
//   3. Range GET     — honor Range → 206 Partial Content for big PDFs.
//   4. HEAD support  — let the browser size-probe without a body fetch.
//   5. Streaming     — `object.body` is piped straight to the client; no
//                      buffering, no `await arrayBuffer()`.
//   6. Per-bucket routing by URL prefix — one Worker, three buckets.
//
// URL layout:
//   GET https://r2.ninjadispute.com/<bucket>/<key>
// where <bucket> ∈ { clients-docs, credit-reports, letter-assets }.

export interface Env {
  CLIENTS_DOCS: R2Bucket;
  CREDIT_REPORTS: R2Bucket;
  LETTER_ASSETS: R2Bucket;
  R2_BEARER?: string;
  PUBLIC_PREFIXES?: string; // comma- or space-separated bucket prefixes
}

const BUCKETS: Record<string, keyof Env> = {
  "clients-docs": "CLIENTS_DOCS",
  "credit-reports": "CREDIT_REPORTS",
  "letter-assets": "LETTER_ASSETS",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, "");
    const slash = path.indexOf("/");
    if (slash <= 0) return new Response("Bucket missing.", { status: 400 });

    const bucketName = path.slice(0, slash);
    const key = path.slice(slash + 1);
    if (!key) return new Response("Key missing.", { status: 400 });

    const binding = BUCKETS[bucketName];
    if (!binding) return new Response("Unknown bucket.", { status: 404 });
    const bucket = env[binding] as R2Bucket;

    // Auth: public prefixes (e.g. letter-assets/) skip; everything else needs
    // the shared Bearer that ninjacore sends.
    if (!isPublic(bucketName, env) && !checkAuth(request, env)) {
      return new Response("Unauthorized.", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }

    // ── Cache API fast path ────────────────────────────────────────────────
    // Build a stable cache key that includes the Range header so partial reads
    // and full reads don't collide. Auth header is intentionally *not* part of
    // the cache key — auth is checked above on every request.
    const range = request.headers.get("range") ?? "";
    const cacheKeyUrl = new URL(request.url);
    if (range) cacheKeyUrl.searchParams.set("__r", range);
    const cache = caches.default;
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    const cached = await cache.match(cacheKey);
    if (cached) {
      // For HEAD, strip the body but keep headers (status, length, etc.).
      if (method === "HEAD") {
        return new Response(null, {
          status: cached.status,
          headers: cached.headers,
        });
      }
      // Revalidate conditional headers against the cached ETag.
      const ifNoneMatch = request.headers.get("if-none-match");
      const etag = cached.headers.get("etag");
      if (ifNoneMatch && etag && etagMatches(ifNoneMatch, etag)) {
        return new Response(null, { status: 304, headers: cached.headers });
      }
      return cached;
    }

    // ── Origin (R2) fetch ──────────────────────────────────────────────────
    const r2Opts: R2GetOptions = {};
    const onlyIf: R2Conditional = {};
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) onlyIf.etagDoesNotMatch = stripQuotes(ifNoneMatch);
    const ifModifiedSince = request.headers.get("if-modified-since");
    if (ifModifiedSince) {
      const d = new Date(ifModifiedSince);
      if (!isNaN(d.getTime())) onlyIf.uploadedAfter = d;
    }
    if (ifNoneMatch || ifModifiedSince) r2Opts.onlyIf = onlyIf;

    const parsedRange = parseRange(range);
    if (parsedRange) r2Opts.range = parsedRange;

    const object =
      method === "HEAD"
        ? await bucket.head(key)
        : await bucket.get(key, r2Opts);

    if (!object) return new Response("Not found.", { status: 404 });

    // R2 returns an object with no body when the precondition fails (304-ish).
    const isR2GetResult = "body" in object && (object as R2ObjectBody).body !== null;
    if ((ifNoneMatch || ifModifiedSince) && method !== "HEAD" && !isR2GetResult) {
      const h = new Headers();
      writeObjectHeaders(h, object as R2Object);
      return new Response(null, { status: 304, headers: h });
    }

    const headers = new Headers();
    writeObjectHeaders(headers, object as R2Object);

    // Edge cache: 5 minutes browser, 1 day at Cloudflare. Tune per bucket if
    // credit reports turn out to be hotter/colder than client docs.
    headers.set("Cache-Control", "private, max-age=300, must-revalidate");
    headers.set("CDN-Cache-Control", "public, max-age=86400");
    headers.set("Accept-Ranges", "bytes");

    let status = 200;
    if (parsedRange && method === "GET" && "size" in object) {
      const size = (object as R2Object).size;
      const { offset = 0, length } = parsedRange as { offset?: number; length?: number };
      const end = length != null ? offset + length - 1 : size - 1;
      headers.set("Content-Range", `bytes ${offset}-${end}/${size}`);
      headers.set("Content-Length", String(end - offset + 1));
      status = 206;
    }

    if (method === "HEAD") {
      return new Response(null, { status, headers });
    }

    const body = (object as R2ObjectBody).body;
    const response = new Response(body, { status, headers });

    // Stash full-object 200s in the edge cache; skip 206s (range fragments
    // bloat the cache for marginal benefit).
    if (status === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  },
} satisfies ExportedHandler<Env>;

function isPublic(bucketName: string, env: Env): boolean {
  const raw = env.PUBLIC_PREFIXES ?? "";
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .includes(bucketName);
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.R2_BEARER) return true; // no secret set → open (dev only)
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return !!m && timingSafeEqual(m[1].trim(), env.R2_BEARER);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function stripQuotes(s: string): string {
  return s.replace(/^W\//, "").replace(/^"|"$/g, "").trim();
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const want = stripQuotes(etag);
  return ifNoneMatch
    .split(",")
    .map((s) => stripQuotes(s.trim()))
    .some((tag) => tag === "*" || tag === want);
}

function parseRange(value: string): R2Range | undefined {
  if (!value) return undefined;
  // Only single-range is supported by R2; "bytes=START-END" or "bytes=START-".
  const m = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!m) return undefined;
  const start = m[1] === "" ? undefined : Number(m[1]);
  const end = m[2] === "" ? undefined : Number(m[2]);
  if (start == null && end == null) return undefined;
  if (start != null && end != null) {
    return { offset: start, length: end - start + 1 };
  }
  if (start != null) return { offset: start };
  // Suffix range "bytes=-N" → last N bytes
  if (end != null) return { suffix: end };
  return undefined;
}

function writeObjectHeaders(h: Headers, obj: R2Object): void {
  obj.writeHttpMetadata(h);
  h.set("ETag", obj.httpEtag);
  if (obj.uploaded) h.set("Last-Modified", obj.uploaded.toUTCString());
  if (!h.has("Content-Length")) h.set("Content-Length", String(obj.size));
}
