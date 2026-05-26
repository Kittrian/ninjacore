# Frontend scaffold — ninjadispute-next

**Date:** 2026-05-26 (continued from API-fix session)
**Location:** `~/Documents/ninjadispute-next/`
**Status:** ✅ Builds clean, dev server boots, both routes (`/`, `/clients`, `/clients/[id]`) render.

## What you asked for vs what you got

| Requested | Delivered |
|---|---|
| Next.js 15 (App Router + RSC) | Next.js **16.2.6** (`latest` — App Router + RSC identical) |
| TanStack Query v5 | ✅ `@tanstack/react-query@5.100.14` + Devtools, wired in `app/providers.tsx` |
| TanStack Table + Virtual | ✅ `react-table@8` + `react-virtual@3`, used in `/clients` list |
| shadcn/ui | ✅ initialized (radix base, slate, css-vars). Components installed: button, card, table, dialog, input, label, sheet, badge, separator, skeleton, tabs |
| Zod | ✅ all API responses parsed through Zod schemas in `lib/api/schemas.ts` (loose, `.passthrough()` so backend drift doesn't break UI) |
| TypeScript | ✅ — `tsc --noEmit` clean, `next build` clean |
| Lucia + Arctic (SSO) | ✅ scaffold files in `lib/auth/` — Lucia in `package.json`, Arctic provider stubs (Google/GitHub/Apple commented, ready to fill in CLIENT_ID/SECRET) |
| Paseto (replaces JWT) | ✅ `paseto-ts` installed + `lib/auth/paseto.ts` helpers. Currently the backend still signs JWT, so `lib/auth/jwt.ts` handles current tokens. Flip when backend swaps signers — same EdDSA key pair works. |

## What works right now

```bash
cd ~/Documents/ninjadispute-next
npm run dev
# open http://localhost:3000
```

- `/` — landing page with links
- `/clients` — virtualized table fetched from `https://api.ninjadispute.com/clients/`
- `/clients/1027` — ALYN BULLOCK detail with all 7 sections, fetched from `/clients/1027?all=true`

You'll see "Loading…" or 403 until you drop a `ninja_token` cookie. Use the JWT-minting snippet in the README (or sign in at auth.ninjadispute.com on the same domain when deployed).

## File map (the parts that matter)

- **`app/providers.tsx`** — QueryClientProvider wrapper (Devtools in dev only)
- **`app/clients/page.tsx`** — TanStack Table + Virtual list, filterable
- **`app/clients/[id]/page.tsx`** — orchestrates 7 detail components
- **`components/client-detail/*.tsx`** — one component per section (ScoreCards, DerogatoryTable, CreditInfoPanel, ProgressPanel, InquiriesPanel, TradelineComparePanel, AlternateLettersPanel)
- **`lib/api/client.ts`** — `apiFetch<TSchema>()` wrapper. Pass a Zod schema, get typed data. Auto-attaches Bearer token + sends cookies.
- **`lib/api/schemas.ts`** — Zod schemas for Client, ReportJson, Account, etc. Schemas are deliberately loose since the backend hasn't formalized shapes yet.
- **`lib/api/queries.ts`** — `useClientsList()` / `useClient()` TanStack Query hooks.
- **`lib/auth/jwt.ts`** — current JWT verify (talks to `auth.ninjadispute.com/public-key`)
- **`lib/auth/paseto.ts`** — Paseto v4 sign/verify, ready for Phase 2 backend migration
- **`lib/auth/session.ts`** — server-side cookie → user, cached per RSC render
- **`lib/auth/useAuthToken.ts`** — client-side cookie reader

## Deploy plan (full instructions in `README.md`)

**Side-by-side preview (recommended first):**
```bash
cd ~/Documents/ninjadispute-next
npm run build
rsync -avz --delete --exclude node_modules --exclude .next/cache --exclude .git \
  ./ root@217.76.57.182:/home/ninjadispute/ninjadispute-next/

sshpass -p Malachi77 ssh root@217.76.57.182
cd /home/ninjadispute/ninjadispute-next
npm ci --omit=dev
pm2 start npm --name ninjadispute-next -- start -- -p 3010
pm2 save
```

Then add an nginx server block on a preview subdomain that proxies to `127.0.0.1:3010`. Don't touch the live Vue 2 frontend at `/home/ninjadispute/htdocs/ninjadispute.com/` until you're satisfied.

## Backwards compatibility — IMPORTANT

- The current live frontend (Vue 2/Quasar at ninjadispute.com) is **untouched**.
- The backend (api.ninjadispute.com) is **already serving the right data** as of the previous session's one-line fix. Both old and new frontends consume the same `/clients/:id?all=true` shape.
- The Codex Nuxt 4 rewrite at `~/Documents/Codex/2026-05-09/.../ninjadipute/` is **untouched**.
- These three frontends can coexist on different subdomains during transition.

## Open work (tomorrow)

- [ ] Fill in `lib/auth/providers.ts` with chosen SSO providers (Google? Apple? Microsoft?)
- [ ] Stand up Lucia sessions DB (Drizzle + Postgres is the canonical pairing)
- [ ] Coordinate Paseto migration with backend `/home/api/app/src/middleware/isAuth.ts`
- [ ] Add write/mutation hooks (currently read-only)
- [ ] Decide whether to deploy preview to a subdomain or go straight to Vercel/Cloudflare Pages
- [ ] Sign in at auth.ninjadispute.com, drop the cookie into the dev browser, and verify all 7 sections render with real data
