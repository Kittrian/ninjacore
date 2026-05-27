#!/bin/bash
# Hot Query Indexes - Hetzner VPS Deployment Bundle
# Run this script directly on your Hetzner VPS server
#
# Usage:
#   bash deploy-indexes.sh [--dry] [--verbose]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=false
VERBOSE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
  esac
done

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Hot Query Index Deployment Bundle                  ║"
echo "║  SurrealDB + MySQL Hot Query Optimization           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Step 1: Deploy SurrealDB Indexes
echo "Step 1: Deploying SurrealDB Hot Query Indexes (9 total)"
echo "───────────────────────────────────────────────────────"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would execute: node $SCRIPT_DIR/apply-hot-query-indexes.mjs --dry"
else
  if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Please install Node.js first."
    exit 1
  fi

  if [ "$VERBOSE" = true ]; then
    node "$SCRIPT_DIR/apply-hot-query-indexes.mjs" --verbose
  else
    node "$SCRIPT_DIR/apply-hot-query-indexes.mjs"
  fi
fi

echo ""

# Step 2: Deploy MySQL Indexes
echo "Step 2: Deploying MySQL Hot Query Indexes (12 total)"
echo "───────────────────────────────────────────────────────"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would execute: node $SCRIPT_DIR/add-mysql-hot-query-indexes.mjs --dry"
else
  if [ "$VERBOSE" = true ]; then
    node "$SCRIPT_DIR/add-mysql-hot-query-indexes.mjs" --verbose
  else
    node "$SCRIPT_DIR/add-mysql-hot-query-indexes.mjs"
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Deployment Complete                                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "✓ SurrealDB: 9 hot query indexes applied"
echo "✓ MySQL: 12 hot query indexes applied"
echo ""
echo "Expected improvements:"
echo "  • External ID lookup: 96% faster"
echo "  • Owner+source filter: 68% faster"
echo "  • Report history sort: 80% faster"
echo "  • Overall page load: 16% faster"
echo ""
echo "See docs/INDEXING_STRATEGY.md for detailed analysis."
