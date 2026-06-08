#!/bin/bash
################################################################################
# NINJACORE DEPLOYMENT SCRIPT - LOCAL → GITHUB → SERVER → LIVE
#
# Usage: ./deploy-to-live.sh [frontend|backend|all]
# Default: all
#
# Flow:
#   1. Git push to GitHub (current branch)
#   2. SSH to Hetzner server
#   3. Git pull latest code
#   4. Build frontend (code-split) OR backend (Rust)
#   5. Restart services
#   6. Health checks
#   7. Verify live
#
# Requires: git, sshpass
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Configuration
SERVER="10.0.0.109"
SERVER_USER="drewdrew"
SERVER_PASSWORD="antioch777"
SERVER_PATH="/opt/ninjacore"
FRONTEND_PORT=3000
BACKEND_PORT=3019
DOMAIN="https://ninjacore.ninjadispute.com"

# Get current git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Parse arguments
DEPLOY_TARGET="${1:-all}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}NINJACORE DEPLOYMENT FLOW${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Current branch: ${YELLOW}${CURRENT_BRANCH}${NC}"
echo "Deploy target: ${YELLOW}${DEPLOY_TARGET}${NC}"
echo "Server: ${YELLOW}${SERVER}${NC}"
echo ""

################################################################################
# STEP 1: VALIDATE ENVIRONMENT
################################################################################
echo -e "${BLUE}[STEP 1]${NC} Validating environment..."

if ! command -v git &> /dev/null; then
  echo -e "${RED}✗ git not found${NC}"
  exit 1
fi

if ! command -v sshpass &> /dev/null; then
  echo -e "${RED}✗ sshpass not found (install with: brew install sshpass)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment valid${NC}"
echo ""

################################################################################
# STEP 2: GIT PUSH TO GITHUB
################################################################################
echo -e "${BLUE}[STEP 2]${NC} Pushing to GitHub..."

if [ "$(git status --porcelain)" != "" ]; then
  echo -e "${YELLOW}⚠ Uncommitted changes detected. Commit or stash before deploying.${NC}"
  exit 1
fi

git push origin "${CURRENT_BRANCH}" || {
  echo -e "${RED}✗ Git push failed${NC}"
  exit 1
}

echo -e "${GREEN}✓ Pushed to GitHub${NC}"
echo ""

################################################################################
# STEP 3: SSH TO SERVER & GIT PULL
################################################################################
echo -e "${BLUE}[STEP 3]${NC} Pulling latest code on server..."

SSH_CMD="sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no root@${SERVER}"

$SSH_CMD "cd ${SERVER_PATH} && \
  echo 'Fetching all branches...' && \
  git config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' && \
  git fetch origin && \
  echo 'Checking out branch...' && \
  git checkout ${CURRENT_BRANCH} && \
  echo 'Pulling latest...' && \
  git pull origin ${CURRENT_BRANCH} && \
  echo 'Git status:' && \
  git log --oneline -3" || {
  echo -e "${RED}✗ Git operations failed${NC}"
  exit 1
}

echo -e "${GREEN}✓ Code pulled on server${NC}"
echo ""

################################################################################
# STEP 4: BUILD
################################################################################
case "${DEPLOY_TARGET}" in
  frontend|all)
    echo -e "${BLUE}[STEP 4a]${NC} Building frontend (code-split)..."

    $SSH_CMD "cd ${SERVER_PATH}/FRONT-END && \
      echo '📦 Building with code-splitting...' && \
      /root/.bun/bin/bun run build && \
      echo 'Build artifacts:' && \
      find . -name '*.css' -o -name '*.js' | grep -v node_modules | head -20" || {
      echo -e "${RED}✗ Frontend build failed${NC}"
      exit 1
    }

    echo -e "${GREEN}✓ Frontend built${NC}"
    echo ""
    ;;
esac

case "${DEPLOY_TARGET}" in
  backend|all)
    echo -e "${BLUE}[STEP 4b]${NC} Building backend (Rust)..."

    $SSH_CMD "cd ${SERVER_PATH}/ninjacore && \
      echo '⚙️  Building Rust backend...' && \
      /root/.cargo/bin/cargo build --release 2>&1 | tail -20" || {
      echo -e "${RED}✗ Backend build failed${NC}"
      exit 1
    }

    echo -e "${GREEN}✓ Backend built${NC}"
    echo ""
    ;;
esac

################################################################################
# STEP 5: RESTART SERVICES
################################################################################
echo -e "${BLUE}[STEP 5]${NC} Restarting services..."

case "${DEPLOY_TARGET}" in
  frontend)
    SERVICES="ninja-auth ninjacore-frontend"
    ;;
  backend)
    SERVICES="ninjacore"
    ;;
  all)
    SERVICES="ninja-auth ninjacore ninjacore-frontend"
    ;;
esac

for service in $SERVICES; do
  echo "  Restarting ${service}..."
  $SSH_CMD "systemctl restart ${service} && sleep 2" || {
    echo -e "${RED}✗ Failed to restart ${service}${NC}"
    exit 1
  }
done

echo -e "${GREEN}✓ Services restarted${NC}"
echo ""

################################################################################
# STEP 6: HEALTH CHECKS
################################################################################
echo -e "${BLUE}[STEP 6]${NC} Running health checks..."

# Check frontend
FRONTEND_CHECK=$($SSH_CMD "curl -s http://localhost:${FRONTEND_PORT} | grep -o '<title>' | wc -l")
if [ "$FRONTEND_CHECK" -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} Frontend responding on :${FRONTEND_PORT}"
else
  echo -e "  ${RED}✗${NC} Frontend not responding"
  exit 1
fi

# Check service status
echo "  Service status:"
$SSH_CMD "systemctl status ${SERVICES} --no-pager" | grep -E "Active|Running|Failed" | sed 's/^/    /'

echo -e "${GREEN}✓ Health checks passed${NC}"
echo ""

################################################################################
# STEP 7: VERIFICATION
################################################################################
echo -e "${BLUE}[STEP 7]${NC} Verification..."

echo "  Git commit:"
$SSH_CMD "cd ${SERVER_PATH} && git log --oneline -1" | sed 's/^/    /'

echo ""
echo "  Deployed to: ${YELLOW}${DOMAIN}${NC}"
echo "  Server: ${YELLOW}${SERVER}${NC}"
echo ""

################################################################################
# FINAL STATUS
################################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Visit ${DOMAIN} to verify"
echo "  2. Check browser DevTools (network, performance)"
echo "  3. If issues, check server logs:"
echo "     systemctl status ninjacore-frontend --no-pager"
echo "     journalctl -u ninjacore-frontend.service -n 50"
echo ""
