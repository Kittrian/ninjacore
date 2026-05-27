# ninjacore deploy — pure-speed Hetzner config

Everything in this directory is meant to be copied onto the Hetzner box that
runs ninjacore behind Caddy. Goal: shave every roundtrip we can between
browser → Cloudflare → Caddy → ninjacore.

## What changed vs a default Axum + Caddy setup

| Layer | Before | After | Why |
|---|---|---|---|
| Caddy → ninjacore | TCP `localhost:8080` | Unix socket `/run/ninjacore/ninjacore.sock` | Skips loopback TCP + kernel TCP stack |
| Caddy response buffering | default (buffers small responses) | `flush_interval -1` | Streamed PDFs / R2 proxy bytes flow without buffer pauses |
| Caddy upstream keepalive | implicit | explicit 60s / 64 idle conns | No connection churn on busy endpoints |
| Caddy → client compression | gzip only | zstd + gzip (+ brotli if plugin) | ~25% smaller payloads for JSON-heavy responses |
| Cloudflare → origin | HTTP/1.1 typical | HTTP/2 | One TCP+TLS session multiplexes all requests |
| ninjacore HTTP client | one per call | shared pooled `reqwest::Client` | TLS reuse to R2 / Square / NMI / NinjaDispute |
| ninjacore R2 proxy | re-buffers | streams, forwards Range / 304 | Big-PDF perf, browser revalidation works |

## Install steps

```bash
# 1. Build ninjacore release binary on the box (or copy from CI)
cd /opt/ninjacore && cargo build --release
cp target/release/ninjacore /opt/ninjacore/bin/ninjacore

# 2. Drop the systemd unit
cp deploy/ninjacore.service /etc/systemd/system/
systemctl daemon-reload

# 3. Put Caddy in the ninjacore group so it can read the socket
usermod -a -G ninjacore caddy

# 4. Caddy config
cp deploy/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# 5. Start ninjacore
systemctl enable --now ninjacore

# 6. Verify
ls -l /run/ninjacore/ninjacore.sock          # srw-rw---- 1 ninjacore ninjacore
journalctl -u ninjacore -n 20 --no-pager     # "ninjacore listening (unix)"
curl -s https://api.ninjadispute.com/api/health
```

## Cloudflare dashboard toggles (the free wins)

Do these once in the Cloudflare dashboard — they don't require any code:

1. **Network → "HTTP/2 to Origin"** — toggle **on**.
   Cloudflare → Hetzner becomes h2 multiplexed. Single biggest non-code win.

2. **Network → "HTTP/3 (with QUIC)"** — toggle **on**.
   Browser → Cloudflare uses QUIC. The Caddyfile already enables `h3` for
   the optional direct-to-origin path.

3. **Caching → "Tiered Cache"** — toggle **on**.
   Free. Pushes more cache hits to a regional Cloudflare tier before
   reaching Hetzner. Especially helps the R2 proxy on cold hits.

4. **Speed → "Brotli"** — toggle **on**.
   Cloudflare brotli-encodes responses to the browser even if Caddy didn't.

5. **SSL/TLS → Overview → "Full (Strict)"** — confirm on.
   Required for the HTTPS hop Cloudflare → Hetzner to be encrypted +
   certificate-validated.

6. **SSL/TLS → Edge Certificates → "Min TLS Version" 1.2** — already default.

7. **Rules → Cache Rules** — add rules for `/api/documents/proxy*`
   (already cacheable per ninjacore's `Cache-Control`), `/api/health`,
   and any static asset paths. Eligible-for-cache endpoints never hit
   Hetzner once warm.

## What you'll feel

- **API calls**: ~20-50 ms shaved per request (HTTP/2 reuse Cloudflare→origin
  plus unix socket).
- **PDF / credit-report opens**: noticeably snappier first paint
  (`flush_interval -1` + Range support in the Worker + ninjacore).
- **Sustained traffic**: no connection churn — Caddy and ninjacore both
  hold long-lived pools.

## What's intentionally NOT included

- **Pingora**: overkill for this traffic. Caddy + Tokio give ~95% of the
  benefit with 1% of the rewrite cost.
- **HTTP/2 upstream Caddy → ninjacore**: deliberately HTTP/1.1 over unix.
  H2 multiplexing adds zero value on a loopback unix socket where there is
  no network latency to amortize.
- **TLS Caddy → ninjacore**: unix socket is filesystem-permission scoped;
  TLS there is theater.
