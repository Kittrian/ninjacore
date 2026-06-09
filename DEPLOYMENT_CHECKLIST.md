# NinjaCore Deployment Checklist - June 5, 2026

## Current Status

| Component | Issue | Status |
|-----------|-------|--------|
| Frontend Build | Svelte `{@const}` syntax error at line 232 | 🔴 BLOCKING |
| Frontend Deploy | Assets 404 (build failed) | 🔴 BLOCKED |
| Auth Server | Apple OAuth `invalid_client` error | 🟡 NEEDS FIX |
| Backend | Not tested yet | ⚪ PENDING |

---

## ACTION PLAN (In Order)

### ✅ PHASE 1: FIX SVELTE BUILD (Blocking Everything)

**File:** `/opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte`

**Error:** Lines 230-234 have `{@const}` inside `<div>` instead of before it

**Fix:** Move `{@const client = ...}` to line 229 (before the `<div style=...>`)

**Commands:**
```bash
ssh root@5.78.214.176
nano /opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte

# At line 232, cut this entire line:
#   {@const client = filteredClients[virtualItem.index]}
# 
# Paste it at line 229 (right after the {#each} line, before the <div>)
```

**Verify:** `grep -n "@const" /opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte`
Should show line **229**, not 232.

---

### ✅ PHASE 2: REBUILD FRONTEND

**Commands:**
```bash
cd /opt/ninjacore/FRONT-END
bun run build

# Should succeed now (no errors)

# Copy build to public folder
cp -r build/* ../public/

# Verify assets created
ls -lh /opt/ninjacore/public/*.js | head -5
ls -lh /opt/ninjacore/public/*.css | head -5

# Restart frontend service
systemctl restart ninjacore-frontend ninja-auth
sleep 2

# Verify running
systemctl status ninjacore-frontend --no-pager | grep Active
curl -s -o /dev/null -w "Frontend → %{http_code}\n" http://localhost:3000/
```

---

### ✅ PHASE 3: FIX APPLE OAUTH (Auth Server)

**File:** `/home/ninja/auth-server/src/index.mjs`

**Issue:** Arctic expects Apple private key as DER bytes, not PEM string

**Fix:** Add 3 things to index.mjs:

1. **At top of file, add import:**
```javascript
import fs from 'fs';
```

2. **Add helper function (after imports, before Arctic init):**
```javascript
function pemToDer(pemString) {
  const base64 = pemString
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s/g, '');

  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
```

3. **Replace Apple initialization (find/replace):**

OLD:
```javascript
const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: process.env.APPLE_PRIVATE_KEY,
});
```

NEW:
```javascript
const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8';
const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
const appleKeyDer = pemToDer(appleKeyPem);

const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: appleKeyDer,  // ← DER bytes!
});
```

**Commands:**
```bash
ssh root@5.78.214.176

# Backup first
cp /home/ninja/auth-server/src/index.mjs /home/ninja/auth-server/src/index.mjs.backup

# Edit the file
nano /home/ninja/auth-server/src/index.mjs
# Make the 3 changes above

# Rebuild
cd /home/ninja/auth-server
npm run build

# Restart
systemctl restart ninja-auth
sleep 2

# Verify
journalctl -u ninja-auth.service -n 5 --no-pager
# Should show: Apple: ✅ (before the ✅ ninja-auth listening line)
```

---

### ✅ PHASE 4: FULL DEPLOYMENT TEST

**Commands:**
```bash
ssh root@5.78.214.176

# 1. Check all services
systemctl status ninjacore-frontend ninja-auth ninjacore surrealdb caddy --no-pager

# 2. Test frontend
curl -s -o /dev/null -w "Frontend :3000 → %{http_code}\n" http://localhost:3000/

# 3. Test via Caddy (HTTPS)
curl -k -s -o /dev/null -w "HTTPS :443 → %{http_code}\n" https://localhost/

# 4. Check logs for errors
journalctl -u ninjacore-frontend.service -n 20 --no-pager
journalctl -u ninja-auth.service -n 20 --no-pager
```

---

## Timeline

| Phase | Task | Estimated | Status |
|-------|------|-----------|--------|
| 1 | Fix Svelte @const | 5 min | 🟡 READY |
| 2 | Rebuild frontend | 2 min | ⏳ AFTER #1 |
| 3 | Fix Apple OAuth | 10 min | ⏳ AFTER #2 |
| 4 | Full test | 5 min | ⏳ AFTER #3 |
| **TOTAL** | | **22 min** | |

---

## Reference Docs

- [Svelte @const Fix](./SVELTE_CONST_FIX.md)
- [Apple OAuth PEM→DER Fix](./APPLE_OAUTH_EXACT_FIX.md)
- [Apple SSO 13 Critical Notes](./APPLE_SSO_CRITICAL_NOTES.md)
- [Deployment Guide](./DEPLOYMENT_README.md)

---

## Key Credentials

**Server:** `5.78.214.176` (Hetzner)
**SSH:** `sshpass -p 'Malachi77' ssh root@5.78.214.176`

**Paths:**
- Frontend: `/opt/ninjacore/FRONT-END`
- Auth Server: `/home/ninja/auth-server`
- Backend: `/opt/ninjacore/ninjacore`

---

## Known Issues

1. **GitHub Authentication** - Temporarily bypassed with direct SSH deploy
2. **Svelte Build** - Requires line-level fix (not automated)
3. **Apple OAuth** - Requires manual code edit (PEM→DER conversion)

---

**Status:** Ready to execute Phase 1
**Started:** June 5, 2026 06:21 UTC
