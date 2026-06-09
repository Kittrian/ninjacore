# Server Handoff — 5.78.214.176

## Identity
- Host: `5.78.214.176`
- Primary role: live NinjaCore / Tools Ninja stack
- Access: `ssh root@5.78.214.176`

## Canonical paths
- Live app root: `/opt/ninjacore`
- Auth server: `/home/ninja/auth-server`

## Active services
- `caddy.service`
- `ninja-auth.service`
- `ninjacore.service`
- `ninjacore-app.service`
- `ninjacore-clients.service`
- `surrealdb.service`
- `isolation-surrealdb.service`
- `ultradispute-surrealdb.service`

## What matters
- Treat `/opt/ninjacore` as the only default live NinjaCore project root.
- Do not start with older historical paths unless you verify they are still active for the specific feature.
- This host carries app, auth, and database responsibilities. Be precise about which service actually owns the behavior you are changing.

## Current warnings
- `ninja-frontend.service` is in auto-restart state.
- `isolation-backend.service` is in auto-restart state.
- `isolation-caddy.service` is failed.
- Review those before assuming a frontend or proxy change is complete.

## Safe workflow
1. Confirm the target path under `/opt/ninjacore`.
2. Check `systemctl status` for the exact service you plan to touch.
3. Back up edited files first.
4. Restart only the affected service.
5. Log the change with `/usr/local/bin/agent-handoff-log`.

## Avoid
- Do not treat old `/home/ninjacore/htdocs/...` paths as live by default.
- Do not change firewall, auth, app, and database layers in one blind pass.

---

## Recent Work — 2026-06-08

### Clients Page Performance Optimization (Claude)
**Status:** Code changes complete, awaiting build & deploy

**Changes made:**
- Frontend: `/Users/drewdrew/NinjaTools/FRONT-END/src/routes/clients/+page.svelte`
  - Default view: Clients only (was loading all statuses)
  - Lazy-load Leads (only fetch when "Leads" tab clicked)
  - Replaced status filter dropdown with Clients/Leads tabs
  - Sort order preserved (backend days_left sort)

- API layer: `src/lib/api.ts`
  - Added optional `status` parameter to getClientsPayload()
  - Passes `?status=client` or `?status=lead` to backend

- Query cache: `src/lib/query.ts`
  - queryKeys.clients() now accepts status parameter
  - Separate cache keys for 'clients' and 'leads' tabs

- Backend: `ninjacore-live-20260608/clients.rs`
  - Added status filter to ListClientsQuery struct
  - SQL: `WHERE LOWER(status) = LOWER(?)` when status provided
  - Maintains days_left sort order

**Expected impact:**
- Initial load: ~70% faster (Clients only, not Leads)
- Leads access: Lazy-loaded on first tab click
- Search: Same speed (per-tab)

**Next steps (for Codex):**
1. Build frontend: `npm run build` in FRONT-END/
2. Build backend: `cargo build --release`
3. Deploy to /opt/ninjacore
4. Test: Verify Clients load by default, Leads lazy-load, sort order preserved
5. Restart `ninjacore.service` and `ninjacore-app.service`

**Ready for Codex:** All code changes complete. Run deployment script at `/Users/drewdrew/NinjaTools/deploy/ninjacore-clients-deploy.sh`

**Rollback:** `git revert <commit>` on both frontend and backend repos; restart services.
