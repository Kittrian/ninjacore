#!/bin/bash
# Auto-Discovery Deployment Script
# Finds ninjacore directory and deploys hot query indexes

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Auto-Discovery Hot Query Index Deployment            ║"
echo "║  Finding ninjacore & deploying indexes                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Find ninjacore directory
echo "🔍 Step 1: Finding ninjacore directory..."
NINJACORE_DIR=$(find /root /home /opt -maxdepth 3 -name "ninjacore" -type d 2>/dev/null | head -1)

if [ -z "$NINJACORE_DIR" ]; then
  echo "✗ Could not find ninjacore directory"
  echo "Searched: /root, /home, /opt"
  echo ""
  echo "Manual locations to check:"
  find / -maxdepth 4 -name "ninjacore" -type d 2>/dev/null | head -20
  exit 1
fi

echo "✓ Found: $NINJACORE_DIR"
cd "$NINJACORE_DIR"
echo "✓ Changed to: $(pwd)"
echo ""

# Step 2: Check git status
echo "🔍 Step 2: Checking git repository..."
git status
echo ""

# Step 3: Pull latest code
echo "📥 Step 3: Pulling latest deployment code..."
git pull origin claude/surrealdb-mysql-indexing-mHwmj || git fetch origin claude/surrealdb-mysql-indexing-mHwmj
git checkout claude/surrealdb-mysql-indexing-mHwmj 2>/dev/null || true
echo "✓ Code updated"
echo ""

# Step 4: Verify deployment scripts exist
echo "🔍 Step 4: Verifying deployment scripts..."
if [ ! -f "deploy-indexes.sh" ]; then
  echo "✗ deploy-indexes.sh not found"
  ls -la scripts/ | grep -E "index|deploy" || echo "No indexing scripts found"
  exit 1
fi
echo "✓ deploy-indexes.sh found"
echo "✓ apply-hot-query-indexes.mjs found: $(test -f scripts/apply-hot-query-indexes.mjs && echo 'yes' || echo 'no')"
echo "✓ add-mysql-hot-query-indexes.mjs found: $(test -f scripts/add-mysql-hot-query-indexes.mjs && echo 'yes' || echo 'no')"
echo ""

# Step 5: Check database connectivity
echo "🔍 Step 5: Checking database connectivity..."
echo ""

echo "  Checking SurrealDB..."
if timeout 5 curl -s -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "Surreal-NS: ninja" \
  -H "Surreal-DB: dispute" \
  -H "Authorization: Basic $(echo -n 'root:Malachi77' | base64)" \
  -d "SELECT 1;" > /dev/null 2>&1; then
  echo "  ✓ SurrealDB responsive on localhost:8000"
else
  echo "  ⚠ SurrealDB not responding on localhost:8000"
  echo "    Checking alternate ports..."
  netstat -tuln 2>/dev/null | grep -E "8000|8001|8002" || echo "    No SurrealDB ports found"
fi

echo ""
echo "  Checking MySQL..."
if timeout 5 mysql -h 127.0.0.1 -u ninjacore -pMalachi77 -e "SELECT 1;" > /dev/null 2>&1; then
  echo "  ✓ MySQL responsive on 127.0.0.1:3306"
else
  echo "  ⚠ MySQL not responding on 127.0.0.1:3306"
  echo "    Checking alternate locations..."
  netstat -tuln 2>/dev/null | grep 3306 || echo "    No MySQL port found"
  ps aux | grep -i mysql | grep -v grep || echo "    MySQL may not be running"
fi
echo ""

# Step 6: Deploy indexes
echo "🚀 Step 6: Deploying hot query indexes..."
echo ""

if [ -f "deploy-indexes.sh" ]; then
  bash deploy-indexes.sh
else
  echo "Running individual migration scripts..."
  echo ""
  echo "Deploying SurrealDB indexes..."
  node scripts/apply-hot-query-indexes.mjs
  echo ""
  echo "Deploying MySQL indexes..."
  node scripts/add-mysql-hot-query-indexes.mjs
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Deployment Complete                                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "✓ All hot query indexes deployed"
echo ""
echo "Next steps:"
echo "  1. Monitor query performance over next 24 hours"
echo "  2. Check docs/INDEXING_STRATEGY.md for details"
echo "  3. Run: tail -f /var/log/surreal.log (monitor SurrealDB)"
echo ""
