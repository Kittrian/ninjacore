#!/bin/bash
set -e

echo "🚀 NinjaCore Full Deployment Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Setup
echo -e "${BLUE}[1/7] Creating directories...${NC}"
mkdir -p /opt/ninjacore
cd /opt/ninjacore

# Step 2: Clone repo
echo -e "${BLUE}[2/7] Cloning repository...${NC}"
if [ ! -d ".git" ]; then
  git clone https://github.com/Kittrian/ninjacore.git .
  git checkout claude/nextjs-15-frontend-P13iC
else
  git pull origin claude/nextjs-15-frontend-P13iC
fi

# Step 3: Install Bun (if needed)
echo -e "${BLUE}[3/7] Checking Bun...${NC}"
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
bun --version

# Step 4: Build frontend
echo -e "${BLUE}[4/7] Building frontend...${NC}"
cd /opt/ninjacore/apps/ninjacore-web-svelte
bun install
bun run build
echo -e "${GREEN}✓ Build complete${NC}"
ls -lh dist/index.html

# Step 5: Setup systemd service
echo -e "${BLUE}[5/7] Setting up systemd service...${NC}"
sudo cp ninjacore-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-web.service
echo -e "${GREEN}✓ Service configured${NC}"

# Step 6: Setup Caddy
echo -e "${BLUE}[6/7] Setting up Caddy reverse proxy...${NC}"
sudo cp /opt/ninjacore/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy || sudo systemctl start caddy
echo -e "${GREEN}✓ Caddy configured${NC}"

# Step 7: Start service
echo -e "${BLUE}[7/7] Starting services...${NC}"
sudo systemctl restart ninjacore-web.service
sleep 2

# Verification
echo ""
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "📋 Service Status:"
sudo systemctl status ninjacore-web.service --no-pager | head -10
echo ""
echo "🌐 Access Frontend:"
echo "   Local: http://localhost:3100"
echo "   Remote: http://5.78.214.176:3100"
echo ""
echo "📊 Check Endpoints:"
echo "   Health: curl http://localhost:3100/api/health"
echo "   Clients: curl http://localhost:3100/api/clients"
echo "   Vitals: http://localhost:3100/admin/vitals"
echo ""
echo "📝 View Logs:"
echo "   journalctl -u ninjacore-web.service -f"
echo ""
echo "✨ Done! Frontend is live."
