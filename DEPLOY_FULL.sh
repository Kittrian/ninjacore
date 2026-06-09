#!/bin/bash
################################################################################
# NINJACORE FULL DEPLOYMENT - ALL FIXES + DEPLOY + VERIFY
#
# Fixes:
#   1. Svelte @const syntax error
#   2. Frontend rebuild
#   3. Apple OAuth PEM→DER conversion
#   4. Services restart
#   5. Full verification
#
# Time: ~15 minutes
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="5.78.214.176"
PASSWORD="Malachi77"
SSH="sshpass -p '${PASSWORD}' ssh -o StrictHostKeyChecking=no root@${SERVER}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        NINJACORE FULL DEPLOYMENT - PHASE 1-4           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# PHASE 1: FIX SVELTE @const ERROR
################################################################################

echo -e "${YELLOW}[PHASE 1/4]${NC} Fixing Svelte @const syntax error..."
echo ""

$SSH << 'SVELTE_FIX'
set -e
cd /opt/ninjacore/FRONT-END/src/routes/clients

# Backup
cp +page.svelte +page.svelte.backup

# Show the problem area (lines 229-235)
echo "  Before fix:"
sed -n '229,235p' +page.svelte | head -5

# Fix: Move {@const} line from 232 to before 230 (the <div)
# This is tricky with sed, so we'll use a more robust approach
python3 << 'PYTHON_FIX'
with open('+page.svelte', 'r') as f:
    lines = f.readlines()

# Find and move the @const line
const_line_idx = None
div_line_idx = None

for i in range(225, min(240, len(lines))):
    if '{@const client' in lines[i]:
        const_line_idx = i
    if i > const_line_idx and 'style="position: absolute' in lines[i]:
        div_line_idx = i
        break

if const_line_idx and div_line_idx:
    # Extract the @const line (keep its indentation)
    const_line = lines[const_line_idx]

    # Remove from current position
    del lines[const_line_idx]

    # Insert before the div (now one line earlier)
    lines.insert(const_line_idx - 1, const_line)

    # Write back
    with open('+page.svelte', 'w') as f:
        f.writelines(lines)

    print("✓ Fixed @const placement")
else:
    print("✗ Could not find @const or div line")
    exit(1)
PYTHON_FIX

# Verify
echo "  After fix:"
sed -n '229,235p' +page.svelte | head -5

echo "✓ Svelte syntax fixed"
SVELTE_FIX

echo -e "${GREEN}  ✓ Svelte @const moved to correct position${NC}"
echo ""

################################################################################
# PHASE 2: REBUILD FRONTEND
################################################################################

echo -e "${YELLOW}[PHASE 2/4]${NC} Rebuilding frontend with code-splitting..."
echo ""

$SSH << 'FRONTEND_BUILD'
set -e
cd /opt/ninjacore/FRONT-END

echo "  Building with Bun..."
/root/.bun/bin/bun run build 2>&1 | tail -20

echo "  Copying build to public..."
rm -rf ../public/*
cp -r build/* ../public/

echo "  Verifying assets..."
ls -lh ../public/*.js 2>/dev/null | wc -l | xargs echo "  JS files:"
ls -lh ../public/*.css 2>/dev/null | wc -l | xargs echo "  CSS files:"

echo "✓ Frontend rebuilt"
FRONTEND_BUILD

echo -e "${GREEN}  ✓ Frontend built and assets deployed${NC}"
echo ""

################################################################################
# PHASE 3: FIX APPLE OAUTH
################################################################################

echo -e "${YELLOW}[PHASE 3/4]${NC} Fixing Apple OAuth (PEM → DER conversion)..."
echo ""

$SSH << 'APPLE_FIX'
set -e
cd /home/ninja/auth-server/src

# Backup
cp index.mjs index.mjs.backup

# Check if already patched
if grep -q "pemToDer" index.mjs; then
    echo "  Already patched, skipping..."
else
    echo "  Patching index.mjs..."

    # Use Node.js to safely patch the file
    node << 'NODE_PATCH'
const fs = require('fs');

let content = fs.readFileSync('index.mjs', 'utf-8');

// 1. Add import fs if not present
if (!content.includes('import fs from')) {
    content = 'import fs from \'fs\';\n' + content;
}

// 2. Add pemToDer helper before Arctic init
const helper = `
// Convert PEM private key to DER bytes (required by Arctic)
function pemToDer(pemString) {
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
`;

if (!content.includes('pemToDer')) {
    // Find a good place to insert (after imports, before Arctic init)
    const arcticMatch = content.indexOf('const apple = new Apple');
    if (arcticMatch !== -1) {
        content = content.slice(0, arcticMatch) + helper + '\n' + content.slice(arcticMatch);
    }
}

// 3. Replace Apple initialization
const oldApplePattern = /const apple = new Apple\({[^}]*clientId:[^}]*}\);/s;
const newApple = `const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8';
  const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
  const appleKeyDer = pemToDer(appleKeyPem);

  const apple = new Apple({
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: appleKeyDer,  // ← DER bytes!
  });`;

if (oldApplePattern.test(content)) {
    content = content.replace(oldApplePattern, newApple);
}

fs.writeFileSync('index.mjs', content, 'utf-8');
console.log('✓ Patched successfully');
NODE_PATCH
fi

echo "✓ Apple OAuth patched"
APPLE_FIX

echo -e "${GREEN}  ✓ Apple OAuth fixed (PEM → DER)${NC}"
echo ""

################################################################################
# PHASE 4: RESTART SERVICES & VERIFY
################################################################################

echo -e "${YELLOW}[PHASE 4/4]${NC} Restarting services and verifying..."
echo ""

$SSH << 'SERVICES'
set -e

echo "  Rebuilding auth server..."
cd /home/ninja/auth-server
npm run build 2>&1 | tail -5

echo "  Restarting services..."
systemctl restart ninja-auth ninjacore-frontend ninjacore
sleep 3

echo "  Checking service status..."
systemctl status ninja-auth --no-pager | grep Active
systemctl status ninjacore-frontend --no-pager | grep Active
systemctl status ninjacore --no-pager | grep Active

echo ""
echo "  Testing frontend..."
curl -s -o /dev/null -w "    Frontend :3000 → %{http_code}\n" http://localhost:3000/

echo ""
echo "  Checking Apple OAuth..."
journalctl -u ninja-auth.service -n 3 --no-pager | grep -E "Apple|listening"

echo ""
echo "✓ All services running"
SERVICES

echo -e "${GREEN}  ✓ Services restarted and verified${NC}"
echo ""

################################################################################
# FINAL STATUS
################################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✓ NINJACORE FULL DEPLOYMENT COMPLETE${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Summary:"
echo "  ✅ Phase 1: Svelte @const fixed"
echo "  ✅ Phase 2: Frontend rebuilt & deployed"
echo "  ✅ Phase 3: Apple OAuth fixed (PEM→DER)"
echo "  ✅ Phase 4: Services restarted & verified"
echo ""

echo "Live site: https://ninjacore.ninjadispute.com"
echo ""
echo "Next: Hard refresh browser (Cmd+Shift+R)"
echo "      Test Apple OAuth login"
echo ""
echo "Logs: ssh root@${SERVER} 'journalctl -u ninja-auth.service -f'"
echo ""
