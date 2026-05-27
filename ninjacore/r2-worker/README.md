# ninjacore-r2 — fast R2 fronting Worker

A single Cloudflare Worker that fronts the three R2 buckets used by
NinjaDispute (`clients-docs`, `credit-reports`, `letter-assets`) with the
patterns that actually matter for latency:

1. **Cache API hits** — repeat reads of the same object never touch R2.
2. **Conditional GET** — `If-None-Match` / `If-Modified-Since` → `304 Not Modified`.
3. **Range GET** — `Range: bytes=…` → `206 Partial Content` for big PDFs.
4. **HEAD support** — size probes without a body fetch.
5. **Streaming** — `object.body` is piped straight through; no buffering.
6. **HTTP/2 keepalive** to ninjacore — connection pool reused across requests.

## URL layout

```
GET https://r2.ninjadispute.com/<bucket>/<key>
```

where `<bucket>` is one of `clients-docs`, `credit-reports`, `letter-assets`.

## Auth

Every bucket except those listed in `PUBLIC_PREFIXES` requires
`Authorization: Bearer <R2_BEARER>`. ninjacore sends this automatically when
`R2_BEARER` is set in its env.

```
wrangler secret put R2_BEARER
```

Use the exact same value in ninjacore's `.env`:

```
R2_PUBLIC_BASE=https://r2.ninjadispute.com
R2_BEARER=<same value>
```

## Deploy

```
npm install
npx wrangler deploy
```

Then add a custom domain or route in the Cloudflare dashboard pointing
`r2.ninjadispute.com/*` at this Worker.

## Why this is faster than direct-to-R2 from Rust

- **First hit:** roughly the same — one R2 fetch over the Cloudflare backbone.
- **Repeat hits in the same colo:** served from the Cache API (sub-10 ms),
  no R2 read, no R2 egress class-A charge.
- **Browser revalidation:** `If-None-Match` → `304` in single-digit ms with
  no body transferred.
- **Big PDFs:** browser issues `Range` requests; the Worker returns 206 and
  the browser only fetches the bytes it needs to render the visible page.

## Tuning knobs

- `Cache-Control: max-age=300` (browser) — change per bucket if needed
- `CDN-Cache-Control: max-age=86400` (Cloudflare edge) — bump higher for
  truly immutable assets in `letter-assets/`
- `pool_max_idle_per_host` is set in ninjacore's `state.rs` — increase if
  you see connection churn under load
