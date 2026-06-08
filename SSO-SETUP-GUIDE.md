# NinjaDispute SSO Setup Guide
## Arctic + Lucia + Paseto — Hard-Won Lessons

This doc captures every gotcha hit during the actual implementation so you don't have to rediscover them.

---

## Architecture

```
Browser → auth.ninjadispute.com (Node.js/Express, port 4001, Hetzner 5.78.214.176)
              ↓ OAuth dance with Apple/Google/GitHub
              ↓ issues ninja_token (Paseto/EdDSA, 12h TTL)
              ↓ sets cookie: domain=.ninjadispute.com (ALL subdomains see it)
              ↓ redirects to ninjacore.ninjadispute.com (or wherever)
```

The auth server is the ONLY place that does OAuth. Other apps (ninjacore, api) just redirect to `https://auth.ninjadispute.com/login?provider=X&redirect=https://target.ninjadispute.com`.

---

## GOTCHA #1 — Apple Key Format (the biggest time sink)

Arctic's Apple provider calls `crypto.subtle.importKey("pkcs8", key, ...)` which requires **raw DER bytes** (`Uint8Array`), NOT a PEM string.

### Fix: Convert PEM → DER before passing to `new Apple(...)`

```typescript
function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

const APPLE_PRIVATE_KEY_PEM = String(process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
const APPLE_PRIVATE_KEY     = pemToDer(APPLE_PRIVATE_KEY_PEM);

const apple = new Apple(SERVICES_ID, TEAM_ID, KEY_ID, APPLE_PRIVATE_KEY, REDIRECT_URI);
```

**Error you'll see if you skip this:** `ERR_INVALID_ARG_TYPE` or `DOMException [DataError]: Invalid keyData`

---

## GOTCHA #2 — systemd EnvironmentFile destroys `\n` in unquoted values

When systemd reads `.env` via `EnvironmentFile=`, for **unquoted** values:
> "A backslash followed by any character other than newline will preserve the following character"

So `APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...` → the `\n` becomes just `n`.

This corrupts the base64 → wrong DER bytes → `ERR_OSSL_ASN1_HEADER_TOO_LONG`.

### Fix: Wrap ALL multi-line keys in double quotes in `.env`

```bash
# WRONG — systemd eats the backslashes
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----

# CORRECT — double quotes preserve \n as literal backslash+n
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
```

With double quotes, systemd preserves `\n` verbatim → `replace(/\\n/g, '\n')` in code works correctly.

**Note:** The PASETO keys were already in double quotes and worked fine. The Apple key was NOT quoted — that was the bug.

**Verify with:** `grep 'APPLE_PRIVATE_KEY' /home/ninja/auth-server/.env` — must start with `="`.

---

## GOTCHA #3 — Apple requires `response_mode=form_post` AND `SameSite=none` on the state cookie

Apple **POSTs** the callback cross-origin from `appleid.apple.com`. This means:
1. The `oauth_state` cookie needs `SameSite=none; Secure` (not `lax`) or the cookie won't be sent
2. The Express CORS config must allow `https://appleid.apple.com` as an origin
3. The callback route must handle `req.body` as `application/x-www-form-urlencoded`

```typescript
// In login.ts — Apple needs response_mode=form_post
url.searchParams.set('response_mode', 'form_post');

// Cookie for Apple must be SameSite=none
const sameSite: 'lax' | 'none' = provider === 'apple' ? 'none' : 'lax';
res.cookie('oauth_state', encodedState, {
  httpOnly: true,
  secure: true,       // REQUIRED with SameSite=none
  sameSite,
  maxAge: 600_000,
});
```

---

## GOTCHA #4 — Apple Developer Console redirect URL disappears

When configuring the Services ID in Apple Developer Console:
1. Click the **"+"** button next to "Website URLs"
2. Type the domain, press **Add**
3. Type the return URL, press **Add** (must click Add before Next)
4. THEN click **Next** — clicking Next without clicking Add first silently discards the URLs

**Return URL to register:** `https://auth.ninjadispute.com/callback`
**Domain to register:** `auth.ninjadispute.com`

---

## GOTCHA #5 — The SSO redirect URL must include the `redirect` param pointing to the right app

```
https://auth.ninjadispute.com/login?provider=google&redirect=https://ninjacore.ninjadispute.com
```

The `redirect` param must be in `ALLOWED_REDIRECT_HOSTS` in `login.ts`. Currently allows:
- `ninjadispute.com`
- `api.ninjadispute.com`
- `ninjacore.ninjadispute.com`
- `auth.ninjadispute.com`

---

## GOTCHA #6 — Token TTL must match in 3 places

If you change the TTL, update it in ALL three:
1. `src/paseto.ts` — `TTL_SEC`
2. `src/routes/callback.ts` — `maxAge` on the `ninja_token` cookie
3. `src/routes/verify.ts` — `/token/refresh` endpoint `expiresIn` + cookie `maxAge`

Current TTL: **12 hours (43200s / 43200_000ms)**

---

## GOTCHA #7 — After any `.env` change, rebuild the TypeScript AND restart the service

The compiled JS is in `dist/`. TypeScript source changes don't take effect until:

```bash
cd /home/ninja/auth-server
npm run build                        # recompiles src/ → dist/
systemctl restart ninja-auth         # reloads .env + new dist/
journalctl -u ninja-auth -n 20       # verify clean startup
```

**Verify the service loaded new env:**
```bash
# Quick key test (run from /home/ninja/auth-server):
node --input-type=module < /tmp/test-apple-key.mjs
# Expected: "DER start: 30 81 93 02" and "SUCCESS: private"
```

---

## Quick Reference: Auth Server Files

| File | Purpose |
|------|---------|
| `src/routes/login.ts` | SSO entry points → redirects to Google/GitHub/Apple |
| `src/routes/callback.ts` | OAuth callback → validates code, mints Paseto token, sets cookie |
| `src/routes/verify.ts` | `/token/refresh`, `/status`, `/logout` |
| `src/paseto.ts` | Ed25519 key loading, token mint/verify, `TTL_SEC` |
| `.env` | All secrets — keys MUST be double-quoted |
| `dist/` | Compiled output — always rebuild after source changes |

---

## Apple Key Rotation Checklist

When Apple key is revoked and new one created:
1. Download new `AuthKey_XXXXXXXXXX.p8`
2. Update `.env`: `APPLE_KEY_ID="NEW_KEY_ID"` and `APPLE_PRIVATE_KEY="...PEM with double quotes..."`
3. `npm run build && systemctl restart ninja-auth`
4. Test: attempt Apple login and watch `journalctl -u ninja-auth -f`

---

## Test SSO is Live

```bash
# All should return 302
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  "https://auth.ninjadispute.com/login?provider=google&redirect=https://ninjacore.ninjadispute.com"

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  "https://auth.ninjadispute.com/login?provider=github&redirect=https://ninjacore.ninjadispute.com"

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  "https://auth.ninjadispute.com/login?provider=apple&redirect=https://ninjacore.ninjadispute.com"
```

---

---

## GOTCHA #8 — CORS must explicitly allow `appleid.apple.com`

Apple POSTs the callback from `https://appleid.apple.com`. If your CORS config only allows your own subdomains, the callback will be blocked with a 403/CORS error before your route handler even runs.

```typescript
// In app.ts or wherever CORS is configured
const ALLOWED_ORIGINS = [
  'https://ninjadispute.com',
  'https://api.ninjadispute.com',
  'https://ninjacore.ninjadispute.com',
  'https://auth.ninjadispute.com',
  'https://appleid.apple.com',   // ← REQUIRED for Apple form_post callback
];
```

---

## GOTCHA #9 — The `ninja_token` cookie must be domain-wide, not host-only

If you set the cookie without a `domain` attribute, it only works on the exact host that set it. Set `domain: '.ninjadispute.com'` (leading dot) so ALL subdomains (ninjacore, api, auth, ninjadispute.com itself) can read it automatically.

```typescript
res.cookie('ninja_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  domain: '.ninjadispute.com',   // ← leading dot = all subdomains
  path: '/',
  maxAge: 43200_000,             // 12 hours
});
```

This is what lets `ninjacore.ninjadispute.com` call `api.ninjadispute.com` with `credentials: 'include'` and have the token sent automatically — no proxy or token passing needed.

---

## GOTCHA #10 — Cross-domain API calls need `credentials: 'include'` + 401 forced-logout

When the frontend (ninjacore) calls the API, cookies won't be sent unless you explicitly include credentials:

```javascript
// WRONG — cookie never sent cross-domain
const res = await fetch('https://api.ninjadispute.com/clients');

// CORRECT
const res = await fetch('https://api.ninjadispute.com/clients', {
  credentials: 'include',
});
```

### NinjaCore Implementation (event-based pattern)

Rather than embedding logout logic inside every `fetch` call, use a custom event so `app.js` stays decoupled from `login.js`:

**`app.js` — `request()` helper fires the event on 401:**
```javascript
const request = async (url, options = {}) => {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    // 401 mid-session = session expired → signal login.js to force re-login
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('toolsninja:session-expired'));
    }
    throw new Error(payload.error || 'Request failed');
  }

  return response.json();
};
```

**`login.js` — listens for the event and forces re-login:**
```javascript
// Inside initAuthPage() IIFE, after logoutButton handler:
window.addEventListener('toolsninja:session-expired', () => {
  document.cookie = 'txn=; Path=/; Max-Age=0; SameSite=Lax; Secure';
  showMessage('Your session expired. Please sign in again.', true);
  showLogin();
}, { once: false });
```

**Why `once: false`?** Multiple API calls can 401 simultaneously. Each fires the event but `showLogin()` is idempotent — showing the login form twice is harmless.

**Why clear `txn` manually?** The `showLogin()` call hides the page immediately. The `/api/logout` server call is async — by the time it finishes, we've already shown the form. Clearing `txn` client-side ensures no stale cookie triggers a confusing auto-login on next page load.

### Note on startup 401s vs mid-session 401s

The startup `loadClients()` call intentionally SUPPRESSES the 401 event (the user isn't logged in yet):

```javascript
loadClients()
  .catch((error) => {
    setBootLoadingOverlay(false);
    // Suppress unauthorized — login.js handles post-login reload
    if (!String(error.message || '').toLowerCase().includes('unauthorized')) {
      setFormMessage(error.message, true);
    }
    // No session-expired dispatch here — that's for mid-session expiry only
  });
```

The event is only meaningful after the user is already authenticated.

---

## GOTCHA #11 — SSO buttons must point to `auth.ninjadispute.com`, NOT `api.ninjadispute.com`

Easy mistake: copying an old OAuth button URL that points to the wrong server.

```html
<!-- WRONG — api.ninjadispute.com does NOT handle OAuth -->
<a href="https://api.ninjadispute.com/api/auth/google-login">Sign in with Google</a>

<!-- CORRECT — auth server handles the full OAuth dance -->
<a href="https://auth.ninjadispute.com/login?provider=google&redirect=https://ninjacore.ninjadispute.com">
  Sign in with Google
</a>
```

The path is `/login?provider=X`, NOT `/api/auth/google-login`. There's no `/api/` prefix on auth.ninjadispute.com.

---

## GOTCHA #12 — api.ninjadispute.com field names differ from what you'd expect

The Express API uses non-obvious field names. Wrong names = silent empty results, not errors:

| Resource | Field | NOT |
|----------|-------|-----|
| Templates | `name` | `title` |
| Templates | `file_name` | `type` |
| Templates | `file_html` | `content` / `body` |
| Paragraphs | `key` | `title` |
| Paragraphs | `value` | `body` / `category` |
| Creditors | `name` | — |
| Creditors | `value` | — |

Route names also have typos baked in — don't fix them or you'll break the API:
- `/paraghraph` (not `/paragraph`) — yes, missing the 'a'
- `/creditor` (not `/creditor-contacts`)

---

## GOTCHA #13 — Forced logout needs to clear BOTH sessions

ninjacore has its own `txn` session cookie. auth.ninjadispute.com sets the domain-wide `ninja_token`. When logging out or handling 401 expiry, you must hit BOTH endpoints:

```javascript
await Promise.allSettled([
  fetch('/api/logout', { method: 'POST' }),                                           // clears txn
  fetch('https://auth.ninjadispute.com/logout', { method: 'POST', credentials: 'include' }), // clears ninja_token
]);
```

If you only call one, the other cookie survives and the user gets into a broken half-logged-in state.

---

## Common Errors → Root Cause

| Error | Root Cause |
|-------|-----------|
| `ERR_INVALID_ARG_TYPE` in Apple callback | Passing PEM string instead of Uint8Array DER to Arctic |
| `ERR_OSSL_ASN1_HEADER_TOO_LONG` | `.env` value unquoted → systemd corrupts `\n` into `n` → base64 offset |
| `Invalid keyData` | Either of the above two |
| `Authentication failed. Please try again.` (500) | Check `journalctl -u ninja-auth` for the real error |
| Apple callback never fires | `response_mode=form_post` missing, or SameSite=lax on state cookie |
| State mismatch on Apple callback | Cookie not sent because SameSite was `lax` not `none` |
| Google/GitHub SSO loop | Wrong redirect URL in the OAuth button — must point to `auth.ninjadispute.com`, NOT `api.ninjadispute.com` |
| Cookie not sent to API | Missing `credentials: 'include'` on fetch — cross-domain cookies require it explicitly |
| User stuck half-logged-in | Only one of the two logout endpoints was called — need both `/api/logout` AND `auth.ninjadispute.com/logout` |
| API returns empty arrays silently | Wrong field names in query/render — check GOTCHA #12 field name table |
| Apple callback blocked before handler runs | `appleid.apple.com` not in CORS allowed origins list |
