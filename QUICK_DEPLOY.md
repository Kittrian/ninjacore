# Quick Deployment - Copy & Paste

## SSH Into Your VPS

```bash
sshpass -p Malachi77 ssh root@5.78.214.176
```

---

## Then Run This Script (Copy & Paste All)

```bash
#!/bin/bash
set -e

echo "🚀 NinjaCore Deployment"
echo "======================="

# 1. Setup directory
mkdir -p /opt/ninjacore
cd /opt/ninjacore

# 2. Clone repo
echo "📦 Cloning repository..."
if [ ! -d ".git" ]; then
  git clone https://github.com/Kittrian/ninjacore.git .
  git checkout claude/nextjs-15-frontend-P13iC
else
  git pull origin claude/nextjs-15-frontend-P13iC
fi

# 3. Build frontend
echo "🔨 Building frontend..."
cd /opt/ninjacore/apps/ninjacore-web-svelte
bun install
bun run build

# 4. Setup systemd
echo "⚙️ Setting up service..."
sudo cp ninjacore-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-web.service

# 5. Setup Caddy
echo "🔗 Setting up reverse proxy..."
sudo cp /opt/ninjacore/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy 2>/dev/null || sudo systemctl start caddy

# 6. Start service
echo "🚀 Starting service..."
sudo systemctl restart ninjacore-web.service
sleep 2

# 7. Verify
echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "Status:"
sudo systemctl status ninjacore-web.service --no-pager | head -8
echo ""
echo "📍 Access at:"
echo "   http://5.78.214.176:3100"
echo "   http://localhost:3100 (from VPS)"
echo ""
echo "📊 Web Vitals Dashboard:"
echo "   http://5.78.214.176:3100/admin/vitals"
echo ""
echo "📝 View logs:"
echo "   journalctl -u ninjacore-web.service -f"
```

---

## Verify It Works

```bash
# From VPS terminal
curl http://localhost:3100

# From your local machine
curl http://5.78.214.176:3100

# Check health
curl http://5.78.214.176:3100/api/health
```

Should return HTML and JSON responses.

---

## What Gets Installed

✅ StelveKit Frontend (port 3100)
✅ Caddy Reverse Proxy (port 80/443)
✅ systemd Service (auto-restart)
✅ Web Vitals Monitoring
✅ 3000+ Client Rows (virtual scrolling)
✅ Letter Generation (SSE streaming)
✅ API Health Checks

---

## After Deployment

### Access Points

| URL | Purpose |
|-----|---------|
| http://5.78.214.176:3100 | Homepage |
| http://5.78.214.176:3100/clients | Client List |
| http://5.78.214.176:3100/admin/vitals | **Performance Dashboard** |
| http://5.78.214.176:3100/api/health | Health Check |

### Monitor Logs

```bash
# Real-time logs
journalctl -u ninjacore-web.service -f

# Last 50 lines
journalctl -u ninjacore-web.service -n 50

# Error only
journalctl -u ninjacore-web.service | grep error
```

### Check Service Status

```bash
# Service status
sudo systemctl status ninjacore-web.service

# Is it running?
ps aux | grep bun

# Port listening?
lsof -i :3100
```

### Test Performance

```bash
# Install wrk (if needed)
apt-get install wrk

# Load test
wrk -t4 -c100 -d30s http://localhost:3100/api/clients

# Expected:
# Latency: <50ms
# Requests/sec: >1000
```

---

## Troubleshooting

### Service won't start

```bash
journalctl -u ninjacore-web.service -n 100
# Check for errors and fix them

# Try manual start
bun run start --port 3100
```

### Port 3100 already in use

```bash
lsof -i :3100
sudo kill -9 <PID>
sudo systemctl restart ninjacore-web.service
```

### Building fails

```bash
cd /opt/ninjacore/apps/ninjacore-web-svelte
bun install --force
bun run build
```

---

## Next Steps

1. ✅ Run deployment script above
2. ✅ Verify it loads at http://5.78.214.176:3100
3. ✅ Check Web Vitals at /admin/vitals
4. Connect Rust backend (when ready)
5. Scale horizontally (when needed)

**Done! Your frontend is live.** 🎉
