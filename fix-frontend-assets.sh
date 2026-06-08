#!/bin/bash
################################################################################
# FIX FRONTEND 404 ERRORS - CLEAN BUILD & DEPLOY
#
# Problem: Old HTML/assets still being served
# Solution: Clean, rebuild, and verify assets are correct
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="10.0.0.109"
SERVER_USER="drewdrew"
SERVER_PASSWORD="antioch777"
SERVER_PATH="/opt/ninjacore"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}FIXING FRONTEND ASSET 404 ERRORS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

SSH="sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no root@${SERVER}"

# STEP 1: Check current branch
echo -e "${BLUE}[STEP 1]${NC} Checking current branch..."
CURRENT_BRANCH=$($SSH "cd ${SERVER_PATH} && git rev-parse --abbrev-ref HEAD")
echo "  Current branch: ${YELLOW}${CURRENT_BRANCH}${NC}"
echo ""

# STEP 2: Clean old build artifacts
echo -e "${BLUE}[STEP 2]${NC} Cleaning old build artifacts..."
$SSH "cd ${SERVER_PATH} && \
  rm -rf /opt/ninjacore/public/* && \
  echo '  Cleaned /opt/ninjacore/public/*' && \
  find . -name '.env' -o -name 'build' | head -5"
echo -e "  ${GREEN}✓${NC} Old artifacts removed"
echo ""

# STEP 3: Fresh git pull
echo -e "${BLUE}[STEP 3]${NC} Fresh git pull..."
$SSH "cd ${SERVER_PATH} && \
  git fetch origin && \
  git reset --hard origin/${CURRENT_BRANCH} && \
  git log --oneline -1"
echo -e "  ${GREEN}✓${NC} Repository clean"
echo ""

# STEP 4: Clean node_modules and reinstall
echo -e "${BLUE}[STEP 4]${NC} Reinstalling dependencies..."
$SSH "cd ${SERVER_PATH} && \
  rm -rf node_modules package-lock.json && \
  npm install --production 2>&1 | tail -5"
echo -e "  ${GREEN}✓${NC} Dependencies fresh"
echo ""

# STEP 5: Check for build.mjs
echo -e "${BLUE}[STEP 5]${NC} Checking build configuration..."
$SSH "cd ${SERVER_PATH} && \
  ls -lh build.mjs package.json && \
  cat package.json | grep -A 5 'scripts'"
echo ""

# STEP 6: Clean build from scratch
echo -e "${BLUE}[STEP 6]${NC} Building frontend (fresh)..."
$SSH "cd ${SERVER_PATH} && \
  echo 'Starting build...' && \
  node build.mjs 2>&1 | tail -50" || {
  echo -e "  ${RED}✗${NC} Build failed, checking logs..."
  $SSH "cd ${SERVER_PATH} && ls -la public/"
  exit 1
}
echo -e "  ${GREEN}✓${NC} Build complete"
echo ""

# STEP 7: Verify assets were created
echo -e "${BLUE}[STEP 7]${NC} Verifying assets..."
ASSETS_CHECK=$($SSH "ls -lh ${SERVER_PATH}/public/ | wc -l")
if [ "$ASSETS_CHECK" -gt 5 ]; then
  echo -e "  ${GREEN}✓${NC} Assets generated (${ASSETS_CHECK} files)"
  $SSH "ls -lh ${SERVER_PATH}/public/*.css ${SERVER_PATH}/public/*.js 2>/dev/null | head -10" | sed 's/^/    /'
else
  echo -e "  ${RED}✗${NC} No assets found in public/"
  $SSH "ls -la ${SERVER_PATH}/public/"
  exit 1
fi
echo ""

# STEP 8: Verify key files exist
echo -e "${BLUE}[STEP 8]${NC} Checking critical files..."
CRITICAL_FILES=(
  "public/styles.critical.css"
  "public/styles.lazy.css"
  "public/nd-app-loader.js"
  "public/index.html"
  "server.mjs"
)

for file in "${CRITICAL_FILES[@]}"; do
  EXISTS=$($SSH "test -f ${SERVER_PATH}/${file} && echo 'yes' || echo 'no'")
  if [ "$EXISTS" = "yes" ]; then
    echo -e "  ${GREEN}✓${NC} ${file}"
  else
    echo -e "  ${RED}✗${NC} ${file} MISSING"
  fi
done
echo ""

# STEP 9: Restart frontend service
echo -e "${BLUE}[STEP 9]${NC} Restarting frontend service..."
$SSH "systemctl restart ninjacore-frontend && sleep 3"
SERVICE_STATUS=$($SSH "systemctl is-active ninjacore-frontend")
if [ "$SERVICE_STATUS" = "active" ]; then
  echo -e "  ${GREEN}✓${NC} Frontend service running"
else
  echo -e "  ${RED}✗${NC} Frontend service failed"
  $SSH "journalctl -u ninjacore-frontend.service -n 20 --no-pager"
  exit 1
fi
echo ""

# STEP 10: Test asset serving
echo -e "${BLUE}[STEP 10]${NC} Testing asset delivery..."
CSS_TEST=$($SSH "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/styles.critical.css")
JS_TEST=$($SSH "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/nd-app-loader.js")
HTML_TEST=$($SSH "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/")

echo "  Requests to :3000:"
echo -e "    /styles.critical.css → ${CSS_TEST}"
echo -e "    /nd-app-loader.js → ${JS_TEST}"
echo -e "    / (index.html) → ${HTML_TEST}"

if [ "$CSS_TEST" = "200" ] && [ "$JS_TEST" = "200" ] && [ "$HTML_TEST" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} All assets serving correctly"
else
  echo -e "  ${RED}✗${NC} Some assets still missing"
  $SSH "curl -s http://localhost:3000/ | head -50"
  exit 1
fi
echo ""

# STEP 11: Verify via Caddy
echo -e "${BLUE}[STEP 11]${NC} Testing through Caddy proxy..."
CADDY_TEST=$($SSH "curl -s -k https://localhost/index.html 2>&1 | head -c 200")
if echo "$CADDY_TEST" | grep -q "<!DOCTYPE"; then
  echo -e "  ${GREEN}✓${NC} Caddy is serving frontend correctly"
else
  echo -e "  ${YELLOW}⚠${NC} Caddy proxy test inconclusive (might be DNS/cert issue)"
fi
echo ""

# STEP 12: Show what's live
echo -e "${BLUE}[STEP 12]${NC} Current deployment status..."
$SSH "cd ${SERVER_PATH} && \
  echo 'Branch:' && git rev-parse --abbrev-ref HEAD && \
  echo 'Commit:' && git log --oneline -1 && \
  echo 'Service:' && systemctl is-active ninjacore-frontend && \
  echo 'Assets:' && find public -type f | wc -l && echo 'files served'"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ FRONTEND ASSETS FIXED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next:"
echo "  1. Open https://ninjacore.ninjadispute.com in browser"
echo "  2. Hard refresh (Cmd+Shift+R on Mac)"
echo "  3. Check DevTools Network tab for 404s"
echo "  4. If still broken: ./fix-surrealdb.sh"
echo ""
