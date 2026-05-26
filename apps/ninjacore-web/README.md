# ninjacore-web

Edge-rendered ops console for NinjaCore. Next.js 15 App Router on Cloudflare Workers via OpenNext.

## The architecture

```
Browser → Cloudflare edge (DNS/TLS/WAF/cache)
       → Cloudflare Workers (this app — Next.js 15 + RSC)
       → /api/proxy/[...path] → Hetzner (Rust ninjacore on :3018 → SurrealDB)
```

The frontend never talks to SurrealDB directly. Same-origin `/api/proxy/*` route
handler forwards calls to the Rust API on Hetzner. No CORS, no preflight, no
cookie domain dance. PASETO tokens issued by `ninja-auth.ninjadispute.com`
flow through unchanged.

## Local dev

```bash
cd apps/ninjacore-web
cp .env.example .env.local
# Edit NINJACORE_API_ORIGIN to point at your reachable API
npm install
npm run dev
# open http://localhost:3100
```

The dev server runs Node (`next dev --turbo`). Edge runtime features still work
locally but are faster on Workers in production.

## Preview on Cloudflare locally

```bash
npm run cf:preview
# Builds OpenNext bundle and runs it under wrangler dev (full Workers runtime)
```

## Deploy to Cloudflare

One-time setup:

```bash
# 1. Auth wrangler with your Cloudflare account
npx wrangler login

# 2. Create the R2 bucket used for Next.js incremental cache
npx wrangler r2 bucket create ninjacore-web-cache

# 3. Set production secrets (if any). Example:
# echo "your-paseto-public-key" | npx wrangler secret put AUTH_PASETO_PUBLIC_KEY
```

Then deploy:

```bash
npm run cf:deploy
# Worker is live at https://ninjacore-web.<your-subdomain>.workers.dev
```

To attach the production hostname:

1. In Cloudflare DNS for `ninjadispute.com`, set `ninjacore` → Proxied (orange cloud), AAAA/A 192.0.2.1 (placeholder; Workers route overrides).
2. Uncomment the `[[routes]]` block in `wrangler.toml` (set `pattern = "ninjacore.ninjadispute.com/*"`).
3. Run `npm run cf:deploy` again.

## How requests flow

| URL pattern | Where it's handled |
|---|---|
| `/` | Server Component, rendered at edge |
| `/clients`, `/clients/:id` | Server Components, fetch from Rust API server-side via `lib/api.ts` |
| `/api/proxy/<anything>` | Edge route handler — same-origin proxy to `NINJACORE_API_ORIGIN` |
| `/api/health` | Edge route handler — Worker → upstream probe |
| `/_next/static/*` | Worker Assets binding — served from the nearest POP |

## Replacing Node `server.mjs` over time

The Rust `ninjacore` on Hetzner already implements most `/api/*` routes
(see `ninjacore/src/main.rs`). The remaining Node-only handlers
(IIQ/SC sync, taxonomies, GHL webhook) are being ported to Rust under
`docs/migration-next.md`. Once all routes exist in Rust, point this app's
`NINJACORE_API_ORIGIN` at `https://api.ninjacore.ninjadispute.com` (Rust)
and shut down the Node `ninjacore-web.service`.

## Project layout

```
src/
├── app/
│   ├── layout.tsx              shell + nav
│   ├── page.tsx                landing
│   ├── globals.css             tailwind v4 entry
│   ├── clients/
│   │   ├── page.tsx            list, server-rendered
│   │   └── [id]/page.tsx       detail + bureau cards
│   └── api/
│       ├── health/route.ts     edge probe
│       └── proxy/[...path]/route.ts   same-origin upstream proxy
├── components/
│   └── BureauCards.tsx         TU/EX/EQ score cards
└── lib/
    ├── api.ts                  server-side fetch helper
    └── types.ts                shared ClientDetail / ClientListItem shapes
```
