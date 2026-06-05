#!/bin/bash
################################################################################
# SURREALDB CONNECTION FIX & HEALTH CHECK
#
# This script:
#   1. Checks SurrealDB service status
#   2. Verifies HTTP connectivity
#   3. Tests authentication
#   4. Restarts if needed
#   5. Validates backend can connect
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
SURREALDB_URL="http://127.0.0.1:8000"
SURREALDB_USER="root"
SURREALDB_PASS="change-me"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SURREALDB HEALTH CHECK & FIX${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

SSH_CMD="sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no root@${SERVER}"

# STEP 1: Check service status
echo -e "${BLUE}[STEP 1]${NC} Checking SurrealDB service..."
SERVICE_STATUS=$($SSH_CMD "systemctl is-active surrealdb")

if [ "$SERVICE_STATUS" = "active" ]; then
  echo -e "  ${GREEN}✓${NC} Service is active"
else
  echo -e "  ${YELLOW}⚠${NC} Service not active. Restarting..."
  $SSH_CMD "systemctl restart surrealdb && sleep 3"
  echo -e "  ${GREEN}✓${NC} Service restarted"
fi
echo ""

# STEP 2: Check HTTP connectivity
echo -e "${BLUE}[STEP 2]${NC} Testing HTTP connectivity to SurrealDB..."

HTTP_TEST=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' ${SURREALDB_URL}/health")

if [ "$HTTP_TEST" = "200" ] || [ "$HTTP_TEST" = "404" ]; then
  echo -e "  ${GREEN}✓${NC} HTTP connectivity working (status: ${HTTP_TEST})"
else
  echo -e "  ${RED}✗${NC} HTTP connectivity failed (status: ${HTTP_TEST})"
  echo "  Attempting to restart SurrealDB..."
  $SSH_CMD "systemctl restart surrealdb && sleep 5"
  HTTP_TEST=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' ${SURREALDB_URL}/health")
  if [ "$HTTP_TEST" != "200" ] && [ "$HTTP_TEST" != "404" ]; then
    echo -e "  ${RED}✗${NC} Still failing. Check server logs:"
    echo "    journalctl -u surrealdb.service -n 30"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Connectivity restored"
fi
echo ""

# STEP 3: Test authentication
echo -e "${BLUE}[STEP 3]${NC} Testing SurrealDB authentication..."

AUTH_TEST=$($SSH_CMD "curl -s -u ${SURREALDB_USER}:${SURREALDB_PASS} -X POST ${SURREALDB_URL}/sql \
  -H 'Content-Type: application/json' \
  -d 'SELECT 1' \
  -o /dev/null -w '%{http_code}'")

if [ "$AUTH_TEST" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Authentication successful"
else
  echo -e "  ${RED}✗${NC} Authentication failed (status: ${AUTH_TEST})"
  echo "  Default credentials:"
  echo "    User: ${SURREALDB_USER}"
  echo "    Pass: ${SURREALDB_PASS}"
  echo ""
  echo "  To change, update SurrealDB service:"
  echo "    systemctl edit surrealdb"
  exit 1
fi
echo ""

# STEP 4: Check database/namespace
echo -e "${BLUE}[STEP 4]${NC} Checking database structure..."

DB_CHECK=$($SSH_CMD "curl -s -u ${SURREALDB_USER}:${SURREALDB_PASS} -X POST ${SURREALDB_URL}/sql \
  -H 'Content-Type: application/json' \
  -d 'USE ninja:dispute; SELECT COUNT() FROM clients;' | head -50")

if echo "$DB_CHECK" | grep -q "result"; then
  echo -e "  ${GREEN}✓${NC} Database accessible"
  echo "    Namespace: ninja"
  echo "    Database: dispute"
else
  echo -e "  ${YELLOW}⚠${NC} Database might need initialization"
  echo "    Check: $DB_CHECK"
fi
echo ""

# STEP 5: Restart backend to reconnect
echo -e "${BLUE}[STEP 5]${NC} Restarting backend to reconnect..."

$SSH_CMD "systemctl restart ninjacore && sleep 3"

BACKEND_STATUS=$($SSH_CMD "systemctl is-active ninjacore")

if [ "$BACKEND_STATUS" = "active" ]; then
  echo -e "  ${GREEN}✓${NC} Backend reconnected successfully"
else
  echo -e "  ${YELLOW}⚠${NC} Backend still not running. Checking logs..."
  $SSH_CMD "journalctl -u ninjacore.service -n 10 --no-pager" | sed 's/^/    /'
fi
echo ""

# STEP 6: Final verification
echo -e "${BLUE}[STEP 6]${NC} Final verification..."

$SSH_CMD "systemctl status surrealdb ninjacore --no-pager" | grep -E "Active|running|failed" | sed 's/^/  /'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ SurrealDB check complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "If issues persist:"
echo "  1. SSH to server: ssh root@${SERVER}"
echo "  2. Check SurrealDB logs: journalctl -u surrealdb.service -n 50"
echo "  3. Check backend logs: journalctl -u ninjacore.service -n 50"
echo "  4. Verify DB exists: surrealdb --allow-all"
echo ""
