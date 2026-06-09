#!/bin/bash
################################################################################
# AUTOMATIC APPLE OAUTH FIX
#
# Patches the auth server to convert PEM key to DER bytes before passing to Arctic
# This fixes the "invalid_client" OAuth error
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="5.78.214.176"
PASSWORD="Malachi77"
AUTH_PATH="/home/ninja/auth-server"

SSH="sshpass -p '${PASSWORD}' ssh -o StrictHostKeyChecking=no root@${SERVER}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}APPLE OAUTH FIX - CRITICAL NOTE #1${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Backup
echo -e "${YELLOW}[STEP 1]${NC} Backing up auth server code..."
$SSH "cp ${AUTH_PATH}/src/index.mjs ${AUTH_PATH}/src/index.mjs.before-apple-fix && echo '✓ Backup saved'"
echo ""

# Step 2: Create the helper function file
echo -e "${YELLOW}[STEP 2]${NC} Creating pemToDer helper..."
$SSH "cat > ${AUTH_PATH}/src/utils.mjs << 'EOF'
// Convert PEM private key to DER bytes (required by Arctic for Apple OAuth)
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
EOF
echo '✓ Helper created'"
echo ""

# Step 3: Patch the index.mjs file
echo -e "${YELLOW}[STEP 3]${NC} Patching Arctic Apple initialization..."

$SSH "cat > /tmp/apple-patch.js << 'PATCH_EOF'
const fs = require('fs');

// Read the file
let content = fs.readFileSync('${AUTH_PATH}/src/index.mjs', 'utf-8');

// Check if already patched
if (content.includes('pemToDer')) {
  console.log('Already patched!');
  process.exit(0);
}

// Add import at top (after other imports)
content = content.replace(
  'import { Arctic } from \\'arctic\\';',
  'import fs from \\'fs\\';\nimport { pemToDer } from \\'./utils.mjs\\';\nimport { Arctic } from \\'arctic\\';'
);

// Replace Apple initialization
const oldApple = /const apple = new Apple\({[\\s\\S]*?}\);/;
const newApple = \`const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '${AUTH_PATH}/AuthKey_P2C7S39FX8.p8';
  const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
  const appleKeyDer = pemToDer(appleKeyPem);

  const apple = new Apple({
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: appleKeyDer,  // ← DER bytes, not string!
  });\`;

content = content.replace(oldApple, newApple);

// Write back
fs.writeFileSync('${AUTH_PATH}/src/index.mjs', content, 'utf-8');
console.log('✓ Patched successfully');
PATCH_EOF
node /tmp/apple-patch.js"

echo ""

# Step 4: Verify the patch
echo -e "${YELLOW}[STEP 4]${NC} Verifying patch..."
PATCH_CHECK=$($SSH "grep -c 'pemToDer' ${AUTH_PATH}/src/index.mjs && echo '✓ Patch verified'")
echo "$PATCH_CHECK" | sed 's/^/  /'
echo ""

# Step 5: Rebuild
echo -e "${YELLOW}[STEP 5]${NC} Rebuilding auth server..."
$SSH "cd ${AUTH_PATH} && npm run build 2>&1 | tail -10" || {
  echo -e "${RED}Build failed. Check logs:${NC}"
  $SSH "cd ${AUTH_PATH} && npm run build"
  exit 1
}
echo -e "${GREEN}  ✓ Build successful${NC}"
echo ""

# Step 6: Restart service
echo -e "${YELLOW}[STEP 6]${NC} Restarting ninja-auth service..."
$SSH "systemctl restart ninja-auth && sleep 2"
STATUS=$($SSH "systemctl is-active ninja-auth")

if [ "$STATUS" = "active" ]; then
  echo -e "${GREEN}  ✓ Service running${NC}"
else
  echo -e "${RED}  ✗ Service failed${NC}"
  exit 1
fi
echo ""

# Step 7: Test
echo -e "${YELLOW}[STEP 7]${NC} Testing Apple OAuth..."
LOGS=$($SSH "journalctl -u ninja-auth.service -n 20 --no-pager")
if echo "$LOGS" | grep -q "Apple.*✅"; then
  echo -e "${GREEN}  ✓ Apple OAuth initialized successfully${NC}"
else
  echo -e "${YELLOW}  ⚠ Check logs:${NC}"
  echo "$LOGS" | grep -A 2 -B 2 "Apple" | sed 's/^/    /'
fi
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ APPLE OAUTH FIX APPLIED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next: Test in browser at https://auth.ninjadispute.com/login?provider=apple"
echo "If still broken, check: journalctl -u ninja-auth.service -f"
echo ""
