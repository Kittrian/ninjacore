#!/bin/bash
# 🚀 Automatic deployment script
# Deploys optimized build to Hetzner production

set -e

REMOTE_USER="root"
REMOTE_HOST="5.78.214.176"
REMOTE_APP_DIR="/home/ninjacore/htdocs/ninjacore.ninjadispute.com"
LOCAL_DIST="./dist"
REMOTE_DIST="$REMOTE_APP_DIR/public/dist"

echo "🚀 Starting deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if dist directory exists
if [ ! -d "$LOCAL_DIST" ]; then
  echo "❌ Error: $LOCAL_DIST not found. Run 'npm run build' first."
  exit 1
fi

# Deploy dist files
echo "📦 Syncing /dist files to Hetzner..."
rsync -avz --delete "$LOCAL_DIST/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIST/" || {
  echo "❌ Failed to sync dist files"
  exit 1
}
echo "✅ Dist files deployed"

# Deploy index.html
echo ""
echo "📄 Deploying index.html..."
sshpass -p 'Malachi77' scp index.html "$REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR/" || {
  echo "❌ Failed to deploy index.html"
  exit 1
}
echo "✅ index.html deployed"

# Deploy lazy-loader.js
echo ""
echo "🎯 Deploying lazy-loader.js..."
sshpass -p 'Malachi77' scp lazy-loader.js "$REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR/public/" || {
  echo "❌ Failed to deploy lazy-loader.js"
  exit 1
}
echo "✅ lazy-loader.js deployed"

# Restart service
echo ""
echo "♻️  Restarting ninjacore-web service..."
sshpass -p 'Malachi77' ssh "$REMOTE_USER@$REMOTE_HOST" 'systemctl restart ninjacore-web.service && sleep 2' || {
  echo "❌ Failed to restart service"
  exit 1
}
echo "✅ Service restarted"

# Verify deployment
echo ""
echo "✔️ Verifying deployment..."
sshpass -p 'Malachi77' ssh "$REMOTE_USER@$REMOTE_HOST" "systemctl status ninjacore-web.service --no-pager | head -6"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
