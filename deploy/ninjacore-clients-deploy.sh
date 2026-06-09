#!/bin/bash
set -e

# NinjaCore Clients Performance Optimization Deployment
# Deploys lazy-load Leads + Clients-default frontend changes
# Target: 5.78.214.176 (/opt/ninjacore)

DEPLOY_HOST="root@5.78.214.176"
DEPLOY_PATH="/opt/ninjacore"
LOCAL_FRONTEND="/Users/drewdrew/NinjaTools/FRONT-END"
LOCAL_BACKEND="/Users/drewdrew/NinjaTools/ninjacore-live-20260608"

echo "🚀 Deploying NinjaCore clients optimization..."

# 1. Build frontend
echo "📦 Building frontend..."
cd "$LOCAL_FRONTEND"
npm run build
FRONTEND_DIST=$(pwd)/build

# 2. Build backend
echo "📦 Building backend..."
cd "$LOCAL_BACKEND"
cargo build --release
BACKEND_BIN="$(pwd)/target/release/ninjacore"

# 3. Backup live files
echo "💾 Backing up live files on server..."
ssh "$DEPLOY_HOST" "cp -r $DEPLOY_PATH $DEPLOY_PATH.backup.$(date +%s)" || true

# 4. Deploy frontend
echo "📤 Deploying frontend..."
ssh "$DEPLOY_HOST" "systemctl stop ninjacore-app.service || true"
rsync -av "$FRONTEND_DIST/" "$DEPLOY_HOST:$DEPLOY_PATH/public/spa/"

# 5. Deploy backend
echo "📤 Deploying backend..."
ssh "$DEPLOY_HOST" "systemctl stop ninjacore.service || true"
scp "$BACKEND_BIN" "$DEPLOY_HOST:$DEPLOY_PATH/ninjacore"
ssh "$DEPLOY_HOST" "chmod +x $DEPLOY_PATH/ninjacore"

# 6. Restart services
echo "♻️  Restarting services..."
ssh "$DEPLOY_HOST" "systemctl start ninjacore.service"
sleep 2
ssh "$DEPLOY_HOST" "systemctl start ninjacore-app.service"
sleep 2

# 7. Verify
echo "✅ Verifying deployment..."
ssh "$DEPLOY_HOST" "systemctl status ninjacore.service && systemctl status ninjacore-app.service"

echo "✨ Deployment complete!"
echo "📋 Changes:"
echo "  - Default view: Clients only"
echo "  - Leads: Lazy-loaded on tab click"
echo "  - Sort: Days left (most urgent first)"
echo ""
echo "🔄 Rollback:"
echo "  ssh $DEPLOY_HOST 'mv $DEPLOY_PATH.backup.* $DEPLOY_PATH && systemctl restart ninjacore.service ninjacore-app.service'"
