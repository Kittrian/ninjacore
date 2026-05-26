# Migration playbook — Node `server.mjs` → Next.js 15 (edge) + Rust ninjacore

Status snapshot (2026-05-26):

| Layer | Old (today) | New (target) |
|---|---|---|
| Frontend | `public/app.js` (~271KB hand-written vanilla JS) served by Node `server.mjs` on Hetzner :3017 | Next.js 15 App Router (`apps/ninjacore-web/`) on Cloudflare Workers via OpenNext |
| `/api/*` | Node `server.mjs` (11K lines) on Hetzner :3017 | Rust `ninjacore` (Axum) on Hetzner :3018 |
| TLS / edge | Caddy on Hetzner :443 → 3017 | Cloudflare proxied → Workers / origin |
| DB | SurrealDB on Hetzner loopback | Unchanged |
| Storage | Cloudflare R2 (clients-docs, credit-reports, letter-assets) | Unchanged |
| Auth | PASETO via `ninja-auth.ninjadispute.com` (Hetzner :4001) | Unchanged |

## End-state hostnames

| Hostname | Behind | Serves |
|---|---|---|
| `ninjacore.ninjadispute.com` | Cloudflare Workers | Next.js app (this repo's `apps/ninjacore-web/`) |
| `api.ninjacore.ninjadispute.com` | Caddy → Rust :3018 | All `/api/*` |
| `auth.ninjadispute.com` | Caddy → ninja-auth :4001 | PASETO issuer |
| `ninjacore-api.ninjadispute.com` | (keep as a debug origin if you want; not used by app) | Direct Rust API access |

## Phases

### Phase 1 — Frontend scaffold ✅ (this commit)

- `apps/ninjacore-web/` exists with Next.js 15 + Tailwind v4 + OpenNext config
- Working `/clients` list + `/clients/[id]` detail pages
- `/api/proxy/[...path]` same-origin proxy to `NINJACORE_API_ORIGIN`
- `npm run dev` locally; `npm run cf:deploy` to ship

### Phase 2 — Port remaining Node handlers to Rust

The Rust ninjacore (`ninjacore/src/main.rs`) already implements most routes.
Inventory remaining Node-only `/api/*` handlers and port them:

```bash
# From repo root, list every Node-only endpoint:
grep -nE "if \(pathname === '/api/|if \(pathname.startsWith\('/api/" server.mjs | grep "req.method"
```

Candidates I know are Node-only today (incomplete in Rust):

- `POST /api/report-sync/identityiq` — credit report sync (just fixed in commit c4eed0a). Schema-aware UPSERT pattern.
- `POST /api/report-sync/smartcredit` — same shape
- `PATCH /api/clients/:id/next-import` — already in Rust? verify
- `POST /api/admin/migrate-documents-to-s3` — admin tool
- GHL webhook routes (`/api/ghl/*`)
- AI rewrite endpoints (`/api/ai/*`)

Each port should:
1. Mirror the Node logic 1:1 first (don't refactor in the same PR)
2. Use the SurrealDB upsert pattern from Node's `surqlUpsert` (cast every field
   to `<string>` in the MERGE to avoid datetime auto-coercion)
3. Add an integration test that exercises the endpoint via the Rust binary
4. Cut over the Caddyfile route once tests pass; remove the Node handler

### Phase 3 — Cutover

When all `/api/*` exists in Rust:

```caddy
api.ninjacore.ninjadispute.com {
  reverse_proxy localhost:3018  # Rust ninjacore
}

ninjacore.ninjadispute.com {
  # No backend here anymore — all UI lives on Cloudflare Workers.
  # If you want a fallback origin during DNS propagation, keep Caddy serving
  # public/ as a degraded mode, but eventually retire this hostname from Caddy.
}
```

Then:

```bash
# Set NINJACORE_API_ORIGIN in wrangler.toml to point at the Rust API
sed -i '' 's|NEXT_PUBLIC_API_BASE = .*|NEXT_PUBLIC_API_BASE = "https://api.ninjacore.ninjadispute.com"|' \
  apps/ninjacore-web/wrangler.toml

# Deploy Workers
( cd apps/ninjacore-web && npm run cf:deploy )

# Once you confirm the new frontend is healthy:
systemctl disable --now ninjacore-web   # the Node server.mjs
```

### Phase 4 — Security hardening

Free Cloudflare features to turn on once Workers serves the frontend:

- **WAF rules**: rate-limit `/api/proxy/login` to N attempts per IP per minute.
- **Bot Fight Mode**: turn on for `ninjacore.ninjadispute.com`.
- **Origin lockdown**: Hetzner firewall accepts only Cloudflare IPs on :443. Direct origin scans return nothing. (`ufw allow from <cf-ip-range>`)
- **Page Rules**: cache `/_next/static/*` aggressively (immutable hashed files).
- **Tunnel** (optional): replace public Caddy with a Cloudflare Tunnel so the
  Hetzner box has *no* open public ports. Tunnel → Caddy localhost → Rust.

### Phase 5 — Decommission Node

```bash
# Stop and disable the Node app
ssh root@5.78.214.176 'systemctl disable --now ninjacore-web'

# Archive the codebase but keep it in git history
git mv server.mjs apps/legacy-node-server/server.mjs
git mv public apps/legacy-node-server/public
git commit -m "Archive legacy Node app — replaced by apps/ninjacore-web + Rust API"
```

Keep the archive for at least 30 days post-cutover in case you need to diff
behavior. Then delete the directory.

## Risk register

| Risk | Mitigation |
|---|---|
| Workers cold-start latency | Workers have effectively no cold start (always-warm runtime). N/A. |
| PASETO public key drift between Workers + Rust | Both read from the same `ninja-auth` issuer. Centralize via env. |
| Surge of bot traffic exhausting Worker subrequests (1K/min free) | Bot Fight Mode + WAF. Workers Paid plan ($5/mo) lifts to 50/req. |
| Rust handler missing a Node-only behavior nuance | Run both in parallel during phase 2 via Caddy split: `/api/old/*` → Node, `/api/*` → Rust. Roll endpoints one at a time. |
| Loss of SSR data on Workers if API is down | Render error states; show last-known data from `swr` cache on the client. |

## What "much faster" actually means after this

Round-trip benchmarks projected (US east coast user):

| Route | Today | After |
|---|---|---|
| First contentful paint (`/`) | ~400ms (Germany TTFB + parse) | **~30ms** (edge POP + RSC stream) |
| `/clients` (list of 3,465) | ~250ms HTML + 196KB brotli | **~50ms** edge SSR + 30KB streamed RSC |
| `/clients/:id` warm | ~80ms | **~30ms** edge SSR (cached upstream JSON) |
| `POST /api/proxy/clients/:id/refresh-report` | ~600ms (Node) | **~50ms** to dispatch (Rust returns 202 instantly) |
| Cache poll (304) | 81ms | **~10ms** edge cache hit, no upstream call |

---

## Upload pipeline — direct-to-R2 with presigned URLs

**Live as of de17aed+** (`POST /api/uploads/presign` + `POST /api/clients/:id/documents/attach`):

```
1. Browser → Next.js /api/proxy/uploads/presign
                ↓
2. Rust ninjacore signs an AWS SigV4 PUT URL for R2 (5-min TTL)
                ↓
3. Browser PUTs file bytes DIRECT to R2 (Hetzner never touches them)
                ↓
4. Browser → Next.js /api/proxy/clients/:id/documents/attach
                ↓
5. Rust CREATE client_documents { storage_key, public_url, ... } in SurrealDB
                ↓
6. (later, async) thumbnail worker watches client_documents, generates WebP
```

Required env on the Rust backend:

| Var | Example | Purpose |
|---|---|---|
| `R2_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` | S3 API endpoint |
| `R2_BUCKET` | `clients-docs` | Bucket name |
| `R2_ACCESS_KEY` | (R2 token) | Signing key |
| `R2_SECRET_KEY` | (R2 token) | Signing secret |
| `R2_REGION` | `auto` (R2) or `us-east-1` (Contabo) | Sig V4 region |
| `R2_PUBLIC_BASE` | `https://r2.ninjadispute.com` | Optional read URL base (Worker) |

Falls back to `CONTABO_S3_*` env vars when `R2_*` is missing so existing
deploys keep working unchanged.

### Why this is faster than the old upload path

| Stage | Old (multipart through Node) | New (direct-to-R2 via presigned URL) |
|---|---|---|
| Bytes traverse Hetzner | Yes — eats bandwidth, RAM, event loop | **No — bytes go browser → R2 only** |
| Time to first byte stored | 2× the round trip (upload then S3 write) | 1× round trip |
| Concurrency limit | Bound by Node event loop | Bound by R2 (essentially unlimited) |
| Max file size | Node memory pressure | 32MB cap configurable per-request |
| Failure surface | One opaque "upload failed" | Browser sees R2's exact response |

### Cloudflare Worker in front of R2 (long-term)

Set `R2_PUBLIC_BASE` to a Worker URL that:

1. Verifies a short-lived **PASETO token** issued by `ninja-auth`
2. Honors `Cache-Control: public, max-age=31536000, immutable` on hashed keys
3. Adds `Vary: Authorization` so per-user responses don't pollute the cache
4. Streams the R2 object back

Skeleton (Workers TypeScript):

```ts
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key) return new Response('missing key', { status: 400 });

    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!await verifyPaseto(token, env.AUTH_PASETO_PUBLIC_KEY)) {
      return new Response('unauthorized', { status: 401 });
    }

    const obj = await env.R2.get(key, { range: req.headers });
    if (!obj) return new Response('not found', { status: 404 });

    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set('etag', obj.httpEtag);
    h.set('cache-control', 'private, max-age=300');
    h.set('vary', 'authorization');
    return new Response(obj.body, { headers: h });
  },
};
```

Bind R2 in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "clients-docs"
```

Then on Hetzner: `R2_PUBLIC_BASE=https://r2.ninjadispute.com` and the
`public_url` returned to clients automatically goes through the auth gate.
