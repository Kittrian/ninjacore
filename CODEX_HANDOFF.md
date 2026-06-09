# Codex Deployment Handoff

## Task: Deploy NinjaCore Clients Performance Optimization

**Status:** Ready to deploy  
**Priority:** High (customer-facing performance improvement)  
**Date assigned:** 2026-06-08  

---

## What Was Done (Claude)

Frontend + backend code changes to optimize NinjaCore clients page load:

### Frontend Changes
- **File:** `FRONT-END/src/routes/clients/+page.svelte`
  - Default view: "Clients" only (was loading all statuses)
  - Lazy-load "Leads" when tab clicked
  - Replaced status filter dropdown with clean tab UI
  - Backend sort order preserved (days_left: most negative first)

- **File:** `FRONT-END/src/lib/api.ts`
  - Added status parameter to `getClientsPayload()`

- **File:** `FRONT-END/src/lib/query.ts`
  - Updated queryKeys to support status filtering

### Backend Changes
- **File:** `ninjacore-live-20260608/clients.rs`
  - Added status filtering to list_clients handler
  - Maintains days_left sort order

---

## Your Tasks (Codex)

### 1. Build
```bash
cd /Users/drewdrew/NinjaTools/FRONT-END && npm run build
cd /Users/drewdrew/NinjaTools && cargo build --release
```

### 2. Deploy
Run the automated deployment script:
```bash
bash /Users/drewdrew/NinjaTools/deploy/ninjacore-clients-deploy.sh
```

Or manually:
- Backup: `/opt/ninjacore` → `/opt/ninjacore.backup.{timestamp}`
- Copy frontend build → `/opt/ninjacore/public/spa/`
- Copy backend binary → `/opt/ninjacore/ninjacore`
- Restart: `systemctl restart ninjacore.service ninjacore-app.service`

### 3. Test
On 5.78.214.176, verify:
- [ ] Clients page loads (default "Clients" tab)
- [ ] Client list shows **sorted by days_left** (most negative first)
- [ ] Click "Leads" tab → Leads load
- [ ] Search works in both tabs
- [ ] No errors in syslog

### 4. Log
After successful deployment, log via handoff:
```bash
echo "Deployed NinjaCore clients optimization. Clients default view, lazy-load Leads, days_left sort order preserved. Tests passed." \
  | ssh root@5.78.214.176 /usr/local/bin/agent-handoff-log codex "Deployed: clients default + lazy Leads" "/opt/ninjacore/src/routes/clients|/opt/ninjacore/clients.rs" "Tests: page load, sorting, search all pass" "Rollback: restore from .backup, systemctl restart"
```

---

## Rollback (if needed)
```bash
ssh root@5.78.214.176 "mv /opt/ninjacore /opt/ninjacore.failed && mv /opt/ninjacore.backup.* /opt/ninjacore && systemctl restart ninjacore.service ninjacore-app.service"
```

---

## Questions for Codex
- Do you need SSH key setup, or use existing credentials?
- Run full test suite after deploy, or quick smoke test?
- Notify team in Slack when live?

**Contact:** Claude (via this handoff) if blockers.
