#!/bin/bash
set -e

TARGET_HOST="${1:-root@5.78.214.176}"
DEPLOY_DIR="/opt/ninjacore/frontend"

echo "🚀 Deploying SvelteKit frontend to $TARGET_HOST..."

# Step 1: Build locally
echo "📦 Building for production..."
bun run build

# Step 2: Create deployment package
echo "📦 Creating deployment package..."
tar czf build.tar.gz dist/ build/ package.json bun.lock ninjacore-web.service Caddyfile

# Step 3: Upload to VPS
echo "📤 Uploading to VPS..."
sshpass -p Malachi77 scp -o StrictHostKeyChecking=no build.tar.gz "$TARGET_HOST:/tmp/"

# Step 4: Deploy on VPS
echo "🔧 Deploying on VPS..."
sshpass -p Malachi77 ssh -o StrictHostKeyChecking=no "$TARGET_HOST" bash << 'EOF'
set -e

DEPLOY_DIR="/opt/ninjacore/frontend"

echo "📂 Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"

echo "📦 Extracting build..."
cd "$DEPLOY_DIR"
tar xzf /tmp/build.tar.gz

echo "📦 Installing dependencies..."
bun install --production

echo "🔗 Setting up systemd service..."
sudo cp ninjacore-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-web.service

echo "⚙️ Setting up Caddy config..."
sudo cp Caddyfile /etc/caddy/
sudo systemctl reload caddy || sudo systemctl start caddy

echo "🚀 Starting SvelteKit service..."
sudo systemctl restart ninjacore-web.service

echo "✅ Deployment complete!"
echo "🌐 Available at https://ninjacore.ninjadispute.com"
systemctl status ninjacore-web.service

EOF

echo "✨ Deployment successful!"
echo "📍 Frontend: https://ninjacore.ninjadispute.com"
echo "📍 API: https://api.ninjacore.ninjadispute.com"

# Cleanup
rm build.tar.gz
