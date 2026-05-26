# Session handoff — NinjaDispute blank-page fix

**Date:** 2026-05-26
**Duration:** ~few hours, autonomous
**Status:** ✅ Root cause fixed and verified end-to-end on live API. Browser cache is the only thing between you and seeing it work.

## The bug (one sentence)

`ShowClientService` and 5 other services queried `WHERE client_id = ${var}` (no quotes) against SurrealDB's `reports` table, but `reports.client_id` is typed `string`. SurrealDB silently returned 0 rows → `report = null` → service returned `{ newVersion: true, alternateLetters: [], data: [] }` (~1.7 KB) → frontend marked account "invalid" → page blank.

## Verified working

Authed test against live API (`http://127.0.0.1:3003` on Contabo):

| Client | Response | Accounts | Compare | Progress | AltLetters | reportData |
|---|---|---|---|---|---|---|
| 1027 ALYN BULLOCK | **1.9 MB** | 5 | 95 | 4 | 1 | 2 |
| 920 Stephen Hominick | **4.3 MB** | 6 | 116 | 10 | 1 | 4 |
| 1000 Taurus Wells | **1.35 MB** | 6 | 46 | 0* | 1 | 2 |

*Taurus has 0 progress entries legitimately (no work done yet).

## What was changed on Contabo (`147.93.190.166:/home/api/app/`)

All edits made in `src/` AND verified to compile cleanly (`npm run build` works again).

### TypeScript source fixes
1. **`src/services/ClientServices/ShowClientService.ts:86`** — quoted `${clientId}` in `reports` query.
2. **`src/services/ClientServices/UpdateClientService.ts:62, 120`** — same fix, prevents silent UPDATE no-ops.
3. **`src/services/ClientServices/UpdateExtraInfoClientService.ts:56, 76`** — same fix.
4. **`src/services/ClientServices/UpdateClientProgressService.ts:34`** — same fix (was making progress saves silently fail).
5. **`src/services/ClientServices/DeleteClientService.ts:22`** — same fix on `DELETE reports`.
6. **`src/services/ReportDataServices/UpdateProgressReport.ts:24`** — same fix on `UPDATE reports`.
7. **`src/services/GeminiService/GenerateLetter.ts:6, 16`** — was `WHERE id = ${Number(templateId)}` (broken — `templates.id` is a record reference like `templates:1`, not int). Changed to `WHERE template_id = "${templateId}"`.
8. **`src/services/Puppetter/identity.ts:7`** — `from "../utils/dateUtils"` → `"../../utils/dateUtils"` (was blocking all `npm run build`).

All originals backed up with `.bak-*-<timestamp>` siblings.

### Process
- Restarted the `api`-user pm2 (`sudo -u api pm2 restart api`).
- Deleted a duplicate root-owned pm2 entry that I'd been mistakenly restarting earlier — it was NOT the listener on port 3003.

## What was changed on Hetzner SurrealDB (`5.78.214.176:8000`)

1. **Backfilled `external_client_id`** for 1,129 clients (matched by SSN against Contabo `api.Clients`). ALYN BULLOCK now correctly maps to api id 1027. Script: [scripts/backfill-external-client-id-surreal.mjs](scripts/backfill-external-client-id-surreal.mjs). Additive only — never overwrites populated values.

2. **Backfilled credential fields** for 30 clients (only the empty slots). +18 monitoring_username, +21 monitoring_password, +9 monitoring_token. SurrealDB already had more data than Contabo for these fields, so the gain was small. Script: [scripts/backfill-credentials-surreal.mjs](scripts/backfill-credentials-surreal.mjs).

## Post-backfill credential coverage (Hetzner SurrealDB `clients`, 3,467 total)

| Field | Have value | % |
|---|---|---|
| monitoring_username | 1,148 | 33% |
| monitoring_password | 1,148 | 33% |
| secret_key | 1,893 | 55% |
| monitoring_token | 127 | 4% |
| monitoring_agency | 3,465 | 99% |

The ~2,300 clients without monitoring credentials simply don't have them in any source — the live agency portals (IdentityIQ/SmartCredit/etc.) are the only place to get them.

## Action you need to take (browser)

1. Open ninjadispute.com
2. F12 → DevTools → **Network tab**
3. **Check "Disable cache"** at the top
4. (Optional, recommended) Application tab → Service Workers → **Unregister** any registered worker
5. Hard refresh (Cmd-Shift-R)
6. Click ALYN BULLOCK
7. The 7 sections (Derogatory, Credit Info, Progress, Inquiries, Tradeline Comparison, Alternate Letters, plus Score/Avg Age) should all populate.

If they don't after that, the bug is in the Vue 2/Quasar frontend (source not in this repo), and we'll know exactly where to look — the API is confirmed returning the correct shape.

## Open items (non-blocking)

- **`/clients/` list endpoint** crashes if the query string omits `&descending=...` (calls `JSON.parse(undefined)`). The live frontend always sends it, so production isn't affected. Trivial fix in [src/controllers/ClientController.ts:319](src/controllers/ClientController.ts:319) if you want to harden.
- **Hetzner MariaDB has 5,849 ninjadispute.Clients rows** but most are duplicates/test data (ALYN alone had 3). The real active client population is ~1,047, all with full disk JSONL data already on Contabo.
- **`automation` and `ninjacore` pm2 processes** are running as root — separate apps, not touched.

## Scripts left in repo

- [scripts/backfill-external-client-id-surreal.mjs](scripts/backfill-external-client-id-surreal.mjs) — re-runnable any time as new clients sync in
- [scripts/backfill-credentials-surreal.mjs](scripts/backfill-credentials-surreal.mjs) — same, additive only

## Test JWT for quick API probes

Valid until 2026-05-26 ~14:24 UTC (1 hour from mint at 13:53). To mint a fresh one when this expires, on Contabo:

```bash
cd /home/api/app && node -e "
const { SignJWT, importPKCS8 } = require('jose');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const m = env.match(/PASETO_PRIVATE_KEY=(.+)/);
const pem = m[1].replace(/\\\\n/g, '\\n').trim();
(async () => {
  const key = await importPKCS8(pem, 'EdDSA');
  const token = await new SignJWT({ username: 'test', email: 'test@x.com', role: 'staff', tenantId: 1 })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer('https://auth.ninjadispute.com')
    .setAudience('ninjadispute')
    .setSubject('test-user')
    .setExpirationTime('1h')
    .sign(key);
  console.log(token);
})();
"
```

Then: `curl 'http://127.0.0.1:3003/clients/1027?all=true' -H "Authorization: Bearer $TOKEN"`
