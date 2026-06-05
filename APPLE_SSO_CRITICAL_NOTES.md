# 🍎 Apple SSO - 13 Critical Setup Notes

## Overview

These 13 notes cover the exact gotchas that break Apple OAuth integration. **Every single one** has caused production outages.

---

## #1 — Apple Key Format → Arctic needs `Uint8Array` DER bytes, not PEM string

**Problem:** Arctic OAuth library expects the Apple private key in **DER binary format**, not the PEM text format from Apple Developer.

**What Apple gives you:**
```
-----BEGIN PRIVATE KEY-----
MIGfMA0GCSqGSIb3D...
[base64 content]
-----END PRIVATE KEY-----
```

**What Arctic needs:**
```javascript
// Raw binary Uint8Array (decoded DER bytes)
const derBytes = new Uint8Array([0x30, 0x82, 0x01, ...])
```

**Fix:**
```javascript
// /home/ninja/auth-server/src/index.mjs

import fs from 'fs';

function pemToDer(pemString) {
  // Remove PEM headers
  const base64 = pemString
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s/g, '');
  
  // Decode base64 to binary
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// In Arctic initialization:
const appleKey = fs.readFileSync('./AuthKey_P2C7S39FX8.p8', 'utf-8');
const derKey = pemToDer(appleKey);

const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: derKey,  // ← Uint8Array, not string!
});
```

---

## #2 — systemd destroys unquoted `\n` → Backslash+n becomes just `n`

**Problem:** When systemd reads environment variables, it doesn't parse escape sequences. A multiline PEM key with literal `\n` gets corrupted:

```
Key value: -----BEGIN PRIVATE KEY-----nMIGfMA0GCSqGSIb3D...
                                     ↑ "n" instead of newline
```

**Before (BROKEN):**
```bash
# In systemd service file or .env
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGfMA0GCSqGSIb3D...\n-----END PRIVATE KEY-----
```

**After (FIXED):**
```bash
# In systemd service file or .env - ALWAYS use quotes
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGfMA0GCSqGSIb3D...
-----END PRIVATE KEY-----"
```

**Or in code:**
```javascript
// Better: use actual file, not env var
const appleKey = fs.readFileSync(process.env.APPLE_KEY_PATH, 'utf-8');
```

**Systemd service file:**
```ini
[Service]
Environment="APPLE_PRIVATE_KEY=----- BEGIN PRIVATE KEY -----"
# ^ Must be quoted if multi-line

# Or use file:
Environment=APPLE_KEY_PATH=/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8
```

---

## #3 — Apple needs `form_post` + `SameSite=none` → Apple POSTs the callback cross-origin

**Problem:** Apple OAuth callback is a **form POST** from `appleid.apple.com` (cross-origin). The browser will block the cookie unless it's explicitly marked for cross-site.

**Before (BROKEN):**
```javascript
// Cookie is host-only by default
res.setHeader('Set-Cookie', `ninja_token=${token}; HttpOnly; Secure; Max-Age=43200`);
```

**After (FIXED):**
```javascript
// Must allow cross-site because Apple POSTs from appleid.apple.com
res.setHeader('Set-Cookie', 
  `ninja_token=${token}; HttpOnly; Secure; SameSite=none; Max-Age=43200`
);
```

**Important:** `SameSite=none` **requires** `Secure` (HTTPS only).

**In `/home/ninja/auth-server/src/index.mjs`:**
```javascript
export async function finishOAuth(provider, { user, session }) {
  const token = issueToken({ userId: user.id, sessionId: session.id });
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://ninjacore.ninjadispute.com/?token=${token}`,
      'Set-Cookie': `ninja_token=${token}; HttpOnly; Secure; SameSite=none; Domain=.ninjadispute.com; Max-Age=43200; Path=/`,
    },
  });
}
```

---

## #4 — Apple Developer Console URL disappears → Must click "Add" button

**Problem:** When registering redirect URIs in Apple Developer Console, clicking "Next" WITHOUT clicking "Add" silently discards your URLs.

**Steps:**
1. Go to Apple Developer → App ID → Edit
2. Under "Sign In with Apple" → Configure
3. Add **all three** redirect URLs:
   - `https://auth.ninjadispute.com/callback/apple`
   - `https://ninjacore.ninjadispute.com/callback/apple`
   - `https://localhost:3000/callback/apple` (for local testing)
4. **Click "Add" for EACH URL** (not once at the end)
5. **Then** click "Next"

---

## #5 — `redirect` param must be in the allowlist → URL parameters matter

**Problem:** Your SSO button has a `?redirect=` parameter that must match the `ALLOWED_REDIRECT_HOSTS` list.

**Example:**
```html
<!-- SSO button with redirect -->
<a href="https://auth.ninjadispute.com/login?provider=apple&redirect=https://ninjacore.ninjadispute.com/clients">
  Sign in with Apple
</a>
```

**Must match in code:**
```javascript
// /home/ninja/auth-server/src/index.mjs
const ALLOWED_REDIRECT_HOSTS = [
  'https://ninjacore.ninjadispute.com',
  'https://localhost:3000',
  'http://localhost:3000',
];

function validateRedirect(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_HOSTS.some(host => url.startsWith(host));
  } catch {
    return false;
  }
}
```

---

## #6 — TTL lives in 3 places → Must keep them in sync

**Problem:** Session timeouts are hardcoded in multiple files. Change one and forget the others, users get kicked out randomly.

**All three must match (currently 12 hours = 43200 seconds):**

1. **In `paseto.ts` (token issuance):**
```typescript
export function issueToken(payload: TokenPayload) {
  const token = new Paseto().v4()
    .public()
    .addClaim('exp', new Date(Date.now() + 12 * 60 * 60 * 1000)) // ← 12 hours
    .addClaim('data', payload);
  return token.toString();
}
```

2. **In `callback.ts` (cookie TTL):**
```javascript
res.setHeader('Set-Cookie', 
  `ninja_token=${token}; Max-Age=43200; ...` // ← 43200 seconds = 12 hours
);
```

3. **In `verify.ts` (refresh token validation):**
```typescript
function verifyToken(token: string) {
  const payload = decode(token);
  const now = Date.now();
  const exp = new Date(payload.exp).getTime();
  if (now > exp) throw new Error('Token expired');
  
  // Optional: refresh if <1 hour left
  const timeLeft = exp - now;
  if (timeLeft < 60 * 60 * 1000) {
    // Re-issue new token with another 12 hours
  }
}
```

**Sync checklist:**
- [ ] Token `exp` claim = TTL seconds from now
- [ ] Cookie `Max-Age` = same TTL seconds
- [ ] Verification logic respects the TTL
- [ ] Refresh logic extends by same TTL

---

## #7 — TypeScript must be rebuilt after any change

**Problem:** Changes to `.env` or `.ts` source code don't take effect until you:
1. Rebuild (`npm run build`)
2. Restart service (`systemctl restart ninja-auth`)

**This doesn't work:**
```bash
# Just changing .env
echo "APPLE_CLIENT_ID=new-value" > .env
systemctl restart ninja-auth
# ← Service restarted but OLD compiled code is running
```

**Correct process:**
```bash
# 1. Change source or config
echo "APPLE_CLIENT_ID=new-value" > .env

# 2. Rebuild TypeScript → JavaScript
npm run build

# 3. Restart service with new code
systemctl restart ninja-auth

# 4. Verify
journalctl -u ninja-auth.service -n 10 --no-pager
```

---

## #8 — CORS must include `appleid.apple.com` → Apple's POST is blocked

**Problem:** Apple's callback is a form POST from `appleid.apple.com`. Without explicit CORS headers, the browser blocks it.

**In Express/Node:**
```javascript
import cors from 'cors';

const app = express();

// CORS for Apple callback
app.use(cors({
  origin: ['appleid.apple.com', 'https://appleid.apple.com'],
  methods: ['POST', 'GET'],
  credentials: true,
  allowedHeaders: ['Content-Type'],
}));

// Also needed: explicitly handle Apple's origin
app.post('/callback/apple', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://appleid.apple.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  // ... handle callback
});
```

**Or allow all origins if deployed to production:**
```javascript
app.use(cors({
  origin: true,  // Allow any origin
  credentials: true,
}));
```

---

## #9 — Cookie needs `domain: '.ninjadispute.com'` (leading dot)

**Problem:** Without the leading dot, the cookie is **host-only** and won't be sent to subdomains.

**Before (BROKEN):**
```javascript
// Cookie only works on exact domain
res.setHeader('Set-Cookie', `ninja_token=${token}; Domain=auth.ninjadispute.com; ...`);
```

**After (FIXED):**
```javascript
// Cookie works on all subdomains
res.setHeader('Set-Cookie', `ninja_token=${token}; Domain=.ninjadispute.com; ...`);
//                                            ↑ leading dot
```

**Result:**
- `ninja_token` cookie available on `auth.ninjadispute.com` ✅
- `ninja_token` cookie available on `ninjacore.ninjadispute.com` ✅
- `ninja_token` cookie available on `api.ninjadispute.com` ✅

---

## #10 — Cross-domain fetches need `credentials: 'include'`

**Problem:** When the frontend on `ninjacore.ninjadispute.com` fetches from API on a different origin, cookies are **never** sent by default.

**Before (BROKEN):**
```javascript
// Cookies not sent
fetch('https://api.ninjadispute.com/clients')
  .then(r => r.json())
```

**After (FIXED):**
```javascript
// Cookies ARE sent
fetch('https://api.ninjadispute.com/clients', {
  credentials: 'include'  // ← Magic line
})
  .then(r => r.json())
```

**Also: Dispatch session-expired events instead of inline logout:**
```javascript
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    credentials: 'include',
    ...options,
  });
  
  if (response.status === 401) {
    // Don't inline logout logic here
    // Dispatch custom event instead
    window.dispatchEvent(new CustomEvent('session-expired'));
    return;
  }
  
  return response.json();
}

// Listen globally
window.addEventListener('session-expired', () => {
  localStorage.clear();
  window.location = '/login';
});
```

---

## #11 — SSO buttons point to `auth.ninjadispute.com`, not `api.ninjadispute.com`

**Problem:** OAuth login endpoints live on the **auth server**, not the API server.

**Before (BROKEN):**
```html
<!-- WRONG: API server can't handle OAuth -->
<a href="https://api.ninjadispute.com/login?provider=apple">Sign in</a>
```

**After (FIXED):**
```html
<!-- CORRECT: Auth server handles OAuth -->
<a href="https://auth.ninjadispute.com/login?provider=apple&redirect=https://ninjacore.ninjadispute.com/clients">
  Sign in with Apple
</a>
```

**Path breakdown:**
- ✅ `auth.ninjadispute.com/login?provider=apple` → Start Apple OAuth flow
- ✅ `auth.ninjadispute.com/callback/apple` → Handle Apple callback
- ✅ `ninjacore.ninjadispute.com` → Frontend (receives `?token=` in URL)

---

## #12 — API field names are non-obvious

**Problem:** Different endpoints use different field names. Inconsistent API design.

**Templates:**
```json
{ "name": "...", "file_html": "...", "file_name": "..." }
```

**Paragraphs:**
```json
{ "key": "...", "value": "..." }
```

**Creditors:**
```
GET /api/creditor
POST /api/creditor
```

**Note typo:** The route is `/paraghraph` (not `/paragraph`).

**Check actual API docs or code:**
```bash
curl -s http://api.ninjadispute.com/openapi.json | jq '.paths' | head -50
```

---

## #13 — Logout must hit BOTH endpoints

**Problem:** There are **two** places where session state lives. Clearing one leaves the user in a broken half-logged-in state.

**Logout must hit:**

1. **Rust API logout** (clears `txn` cookie):
```javascript
fetch('https://ninjacore.ninjadispute.com/api/logout', {
  method: 'POST',
  credentials: 'include',
});
```

2. **Auth server logout** (clears `ninja_token` cookie):
```javascript
fetch('https://auth.ninjadispute.com/logout', {
  method: 'POST',
  credentials: 'include',
});
```

**Correct logout function:**
```javascript
async function logout() {
  // Clear Rust API session
  await fetch('https://ninjacore.ninjadispute.com/api/logout', {
    method: 'POST',
    credentials: 'include',
  });
  
  // Clear auth server session
  await fetch('https://auth.ninjadispute.com/logout', {
    method: 'POST',
    credentials: 'include',
  });
  
  // Clear local state
  localStorage.clear();
  sessionStorage.clear();
  
  // Redirect to login
  window.location = '/login';
}
```

---

## Checklist: Apple OAuth Setup

- [ ] #1: Arctic has DER bytes (not PEM string) for private key
- [ ] #2: All PEM keys in `.env` are quoted (with literal newlines)
- [ ] #3: Cookie has `SameSite=none; Secure` for cross-origin POST
- [ ] #4: All 3 redirect URIs added in Apple Developer Console (with Add button)
- [ ] #5: SSO button `?redirect=` matches `ALLOWED_REDIRECT_HOSTS`
- [ ] #6: Token TTL synced in paseto.ts, callback.ts, verify.ts (12 hours)
- [ ] #7: After `.ts` changes: `npm run build` + `systemctl restart ninja-auth`
- [ ] #8: CORS includes `appleid.apple.com`
- [ ] #9: Cookie domain is `.ninjadispute.com` (leading dot)
- [ ] #10: API fetches have `credentials: 'include'`
- [ ] #11: SSO buttons point to `auth.ninjadispute.com/login`
- [ ] #12: Using correct field names for each endpoint type
- [ ] #13: Logout clears both `/api/logout` and `auth.ninjadispute.com/logout`

---

## Quick Test

```bash
# 1. Verify auth server is running
curl -s http://localhost:4001/health

# 2. Trigger Apple login
curl -L "http://localhost:4001/login?provider=apple"

# 3. Check token is set
curl -s -b "ninja_token=..." http://localhost:3019/api/auth/status

# 4. Logout
curl -X POST http://localhost:3019/api/logout -b "txn=..."
curl -X POST http://localhost:4001/logout -b "ninja_token=..."

# 5. Verify cleared
curl -s http://localhost:3019/api/auth/status
# Should return 401
```

---

**Status:** All 13 notes critical for production Apple OAuth
**Setup Time:** 2-4 hours
**Testing Required:** Yes (use actual Apple test account)
