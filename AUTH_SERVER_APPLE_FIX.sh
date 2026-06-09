#!/bin/bash
################################################################################
# FIX APPLE OAUTH ON AUTH SERVER
#
# Critical Issue: Arctic needs Apple private key as DER bytes, not PEM string
# This fix converts PEM → DER and updates the auth server code
################################################################################

set -e

SERVER="5.78.214.176"
SERVER_USER="root"
SERVER_PASSWORD="Malachi77"
AUTH_PATH="/home/ninja/auth-server"

SSH_CMD="sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER}"

echo "🔧 APPLYING APPLE OAUTH FIX..."
echo ""

# 1. Backup existing code
echo "[1/5] Backing up auth server code..."
$SSH_CMD "cp ${AUTH_PATH}/src/index.mjs ${AUTH_PATH}/src/index.mjs.backup"
echo "  ✓ Backup created"
echo ""

# 2. Create the pemToDer helper
echo "[2/5] Adding pemToDer() helper function..."
$SSH_CMD "cat > ${AUTH_PATH}/src/apple-fix.mjs << 'HELPER_EOF'
// Convert PEM private key to DER bytes (required by Arctic)
export function pemToDer(pemString) {
  const base64 = pemString
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\\s/g, '');

  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
HELPER_EOF"
echo "  ✓ Helper created at ${AUTH_PATH}/src/apple-fix.mjs"
echo ""

# 3. Show the required changes to index.mjs
echo "[3/5] Required changes to index.mjs:"
echo ""
echo "  ADD at top of file:"
echo "    import fs from 'fs';"
echo "    import { pemToDer } from './apple-fix.mjs';"
echo ""
echo "  FIND this line (Arctic Apple initialization):"
echo "    const apple = new Apple({"
echo ""
echo "  REPLACE with:"
cat << 'CODE_CHANGE'
  const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8';
  const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
  const appleKeyDer = pemToDer(appleKeyPem);

  const apple = new Apple({
CODE_CHANGE
echo ""
echo "  AND change the privateKey field:"
echo "    OLD:  privateKey: process.env.APPLE_PRIVATE_KEY  ← WRONG (string)"
echo "    NEW:  privateKey: appleKeyDer  ← CORRECT (DER bytes)"
echo ""

# 4. Verify the key file is readable
echo "[4/5] Verifying key file..."
KEY_INFO=$($SSH_CMD "ls -lh /home/ninja/auth-server/AuthKey_*.p8 && echo 'Size check:' && wc -c /home/ninja/auth-server/AuthKey_*.p8")
echo "$KEY_INFO" | sed 's/^/  /'
echo ""

# 5. Show next steps
echo "[5/5] Next Steps:"
echo ""
echo "  1. SSH to server: ssh root@${SERVER}"
echo ""
echo "  2. Edit the auth server code:"
echo "     nano ${AUTH_PATH}/src/index.mjs"
echo ""
echo "  3. Make the changes shown above (add imports, convert key to DER)"
echo ""
echo "  4. Rebuild and restart:"
echo "     cd ${AUTH_PATH}"
echo "     npm run build"
echo "     systemctl restart ninja-auth"
echo ""
echo "  5. Test the callback:"
echo "     journalctl -u ninja-auth.service -f"
echo ""
echo "  6. Verify in browser:"
echo "     https://auth.ninjadispute.com/login?provider=apple"
echo ""
echo "✅ APPLE OAUTH FIX GUIDE READY"
echo ""
