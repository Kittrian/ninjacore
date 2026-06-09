# Apple OAuth Fix - Critical Note #1

## Problem
Arctic library expects Apple private key as **DER bytes (Uint8Array)**, not PEM string.
Current error: `OAuth request error: invalid_client`

## Solution
Convert PEM to DER before passing to Arctic.

---

## Step 1: Add imports to `/home/ninja/auth-server/src/index.mjs`

At the **top of the file**, after other imports, add:

```javascript
import fs from 'fs';
```

---

## Step 2: Add the pemToDer helper function

Add this function somewhere before the Arctic initialization (e.g., after imports):

```javascript
// Convert PEM private key to DER bytes (required by Arctic for Apple OAuth)
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

---

## Step 3: Fix Arctic Apple initialization

**FIND this line (or similar):**
```javascript
const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: process.env.APPLE_PRIVATE_KEY,  // ← WRONG
});
```

**REPLACE with:**
```javascript
// Read and convert PEM to DER
const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8';
const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
const appleKeyDer = pemToDer(appleKeyPem);

const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: appleKeyDer,  // ← CORRECT (DER bytes)
});
```

---

## Step 4: Rebuild and restart

```bash
cd /home/ninja/auth-server
npm run build
systemctl restart ninja-auth
```

---

## Step 5: Verify

```bash
journalctl -u ninja-auth.service -n 10 --no-pager
```

Should show:
```
Google: ✅
GitHub: ✅
Apple:  ✅
✅ ninja-auth listening on 127.0.0.1:4001
```

---

## Environment Check

The `.env` file already has:
```
APPLE_TEAM_ID=5U925CJFA2
APPLE_SERVICES_ID=com.ninjadispute.api.signin
APPLE_KEY_ID=P2C7S39FX8
APPLE_PRIVATE_KEY_PATH=/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8
APPLE_REDIRECT_URI=https://auth.ninjadispute.com/callback
```

The key file exists:
```
-rw-r--r-- 1 root root 257 Jun  5 01:51 /home/ninja/auth-server/AuthKey_P2C7S39FX8.p8
```

This is correct. The fix is **only** in how Arctic is initialized.

---

## Why This Works

1. **PEM format** = text-encoded key with headers (what Apple gives you)
2. **DER format** = raw binary bytes (what Arctic expects)
3. **Conversion** = strip PEM headers + base64-decode → binary array
4. **Result** = Arctic can properly sign OAuth requests with Apple

---

## Reference
See `/Users/drewdrew/NinjaTools/APPLE_SSO_CRITICAL_NOTES.md` - **Note #1**
