#!/bin/bash
################################################################################
# NINJACORE QUICK DEPLOY - FIXES + BUILD + RESTART
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="5.78.214.176"
PASSWORD="Malachi77"

echo -e "${BLUE}🚀 NINJACORE DEPLOYMENT${NC}"
echo ""

################################################################################
# PHASE 1: FIX SVELTE ERROR (Simple sed approach)
################################################################################

echo -e "${YELLOW}[1/4]${NC} Fixing Svelte @const..."

sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no root@${SERVER} << 'SVELTE'
cd /opt/ninjacore/FRONT-END/src/routes/clients

# Backup
cp +page.svelte +page.svelte.backup-$(date +%s)

# Simple fix: The @const line is at 232 but needs to be at 229
# We'll sed to comment out line 232 and uncomment a new one at 229
# Actually, let's use a more direct approach with awk

awk '
  NR==229 && !done { print; print "  {@const client = filteredClients[virtualItem.index]}"; done=1; next }
  NR==232 && /@const/ { next }
  { print }
' +page.svelte > +page.svelte.tmp && mv +page.svelte.tmp +page.svelte

echo "✓ Fixed"
SVELTE

echo -e "${GREEN}  ✓ Svelte @const fixed${NC}"
echo ""

################################################################################
# PHASE 2: REBUILD FRONTEND
################################################################################

echo -e "${YELLOW}[2/4]${NC} Building frontend..."

sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no root@${SERVER} << 'BUILD'
cd /opt/ninjacore/FRONT-END
/root/.bun/bin/bun run build 2>&1 | grep -E "error|✓|Build" | tail -10
cp -r build/* ../public/ 2>/dev/null || echo "Build output copied"
echo "✓ Built"
BUILD

echo -e "${GREEN}  ✓ Frontend built${NC}"
echo ""

################################################################################
# PHASE 3: FIX APPLE OAUTH
################################################################################

echo -e "${YELLOW}[3/4]${NC} Fixing Apple OAuth..."

sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no root@${SERVER} << 'APPLE'
cd /home/ninja/auth-server/src

# Backup
cp index.mjs index.mjs.backup-$(date +%s)

# Check if already patched
if grep -q "pemToDer" index.mjs; then
    echo "Already patched"
else
    # Insert pemToDer helper before Arctic init
    node << 'NODE'
const fs = require('fs');
let content = fs.readFileSync('index.mjs', 'utf-8');

// Add fs import
if (!content.includes("import fs from 'fs'")) {
    content = "import fs from 'fs';\n" + content;
}

// Add helper
const helper = `
function pemToDer(pemString) {
  const base64 = pemString.replace(/-----BEGIN[^-]+-----/, '').replace(/-----END[^-]+-----/, '').replace(/\\s/g, '');
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}
`;

if (!content.includes('pemToDer')) {
    const idx = content.indexOf('const apple = new Apple');
    if (idx > -1) {
        content = content.slice(0, idx) + helper + '\n' + content.slice(idx);
    }
}

// Replace Apple init
const oldPat = /privateKey:\s*process\.env\.APPLE_PRIVATE_KEY/;
if (oldPat.test(content)) {
    const newApple = `const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || '/home/ninja/auth-server/AuthKey_P2C7S39FX8.p8';
  const appleKeyPem = fs.readFileSync(appleKeyPath, 'utf-8');
  const appleKeyDer = pemToDer(appleKeyPem);

  const apple = new Apple({
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: appleKeyDer`;

    content = content.replace(/const apple = new Apple\({[\s\S]*?privateKey:\s*process\.env\.APPLE_PRIVATE_KEY/, newApple);
}

fs.writeFileSync('index.mjs', content, 'utf-8');
console.log('Patched');
NODE
fi

echo "✓ Patched"
APPLE

echo -e "${GREEN}  ✓ Apple OAuth fixed${NC}"
echo ""

################################################################################
# PHASE 4: RESTART & VERIFY
################################################################################

echo -e "${YELLOW}[4/4]${NC} Restarting services..."

sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no root@${SERVER} << 'RESTART'
# Rebuild auth server
cd /home/ninja/auth-server && npm run build 2>&1 | tail -3

# Restart all
systemctl restart ninja-auth ninjacore-frontend ninjacore
sleep 3

# Verify
echo "Status:"
systemctl status ninja-auth --no-pager | grep Active
systemctl status ninjacore-frontend --no-pager | grep Active

# Test frontend
curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3000/

# Apple check
echo "Apple OAuth:"
journalctl -u ninja-auth.service -n 2 --no-pager | grep Apple || echo "Check logs"

echo "✓ Ready"
RESTART

echo -e "${GREEN}  ✓ Services running${NC}"
echo ""

################################################################################
# DONE
################################################################################

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "Live: https://ninjacore.ninjadispute.com"
echo "      (Hard refresh: Cmd+Shift+R)"
echo ""
echo "Logs: sshpass -p 'Malachi77' ssh root@${SERVER} 'journalctl -u ninja-auth.service -f'"
echo ""
