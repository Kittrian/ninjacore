# Complete Deployment Guide - NinjaCore

## Overview

This guide covers deploying the complete StelveKit frontend with Rust backend integration, monitoring, and scaling.

```
┌─────────────────────────────────────┐
│  Browser (User)                     │
└──────────────┬──────────────────────┘
               │ HTTPS
               ↓
┌─────────────────────────────────────┐
│  Caddy Reverse Proxy                │
│  • HTTP/3 • Compression • Caching   │
└──────────────┬──────────────────────┘
               │ localhost:3100
               ↓
┌─────────────────────────────────────┐
│  SvelteKit Frontend (port 3100)     │
│  • Virtual Scrolling • Web Vitals   │
│  • Letter Generation (SSE)          │
└──────────────┬──────────────────────┘
               │ Unix socket
               ↓
┌─────────────────────────────────────┐
│  Rust API (Axum)                    │
│  • Unix socket listener             │
│  • SurrealDB queries                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  SurrealDB (Local)                  │
│  • Client data • Letters            │
└─────────────────────────────────────┘
```

---

## Prerequisites

- VPS with Ubuntu 26.04+ (like yours at 5.78.214.176)
- Bun runtime installed
- Rust toolchain (for API)
- Caddy (optional, for reverse proxy)
- SSH access to VPS

### Install Bun on VPS

```bash
ssh root@5.78.214.176
curl https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### Install Rust on VPS

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

---

## Step 1: Deploy Frontend

### 1.1 Clone Repository

```bash
ssh root@5.78.214.176
git clone https://github.com/Kittrian/ninjacore.git /opt/ninjacore
cd /opt/ninjacore/apps/ninjacore-web-svelte
```

### 1.2 Install & Build

```bash
bun install
bun run build

# Verify build
ls -la dist/
# Should see: dist/index.html (0.38 kB)
```

### 1.3 Production Dependencies

```bash
bun install --production
# Remove dev dependencies to save space
```

### 1.4 Setup systemd Service

```bash
sudo cp ninjacore-web.service /etc/systemd/system/

# Edit if needed
sudo nano /etc/systemd/system/ninjacore-web.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-web.service
sudo systemctl start ninjacore-web.service

# Check status
sudo systemctl status ninjacore-web.service
journalctl -u ninjacore-web.service -f
```

### 1.5 Configure Environment

```bash
cp .env.example .env.local

# Edit configuration
nano .env.local
```

Set these values:

```
NODE_ENV=production
API_PORT=3100
API_HOST=0.0.0.0

# Will connect to Rust API after setup
VITE_API_BASE=/api

# Unix socket (after Rust API is running)
RUST_API_ORIGIN=unix:///tmp/ninjacore.sock
```

**Verify Frontend:**

```bash
curl http://localhost:3100
# Should return HTML (200 OK)
```

---

## Step 2: Setup Reverse Proxy (Caddy)

### 2.1 Install Caddy

```bash
apt-get update
apt-get install -y caddy

caddy version
```

### 2.2 Configure Caddy

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste this config:

```caddyfile
{
  http_port 80
  https_port 443
}

# Local development
localhost:3100 {
  reverse_proxy localhost:3100
}

# Production domain (uncomment when DNS is ready)
# ninjacore.ninjadispute.com {
#   encode zstd gzip
#   
#   header X-Content-Type-Options nosniff
#   header X-Frame-Options DENY
#   header X-XSS-Protection "1; mode=block"
#   header Referrer-Policy "strict-origin-when-cross-origin"
#   header Strict-Transport-Security "max-age=31536000" defer
#   
#   @static {
#     path /_app/immutable/*
#     path /favicon.ico
#   }
#   header @static Cache-Control "public, max-age=31536000, immutable"
#   
#   reverse_proxy localhost:3100 {
#     header_up X-Forwarded-For {http.request.remote}
#     header_up X-Forwarded-Proto {http.request.scheme}
#   }
# }
```

### 2.3 Test & Reload

```bash
sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
sudo systemctl status caddy
```

**Verify Reverse Proxy:**

```bash
curl -I localhost:3100
# Should see 200 OK with HTML headers
```

---

## Step 3: Deploy Rust Backend

### 3.1 Check if Rust API Already Running

```bash
ls -la /tmp/ninjacore.sock
```

If socket exists, skip to step 3.3.

### 3.2 Setup Rust API (If needed)

```bash
# In your Rust project
cargo build --release

# Create systemd service (similar to frontend)
sudo nano /etc/systemd/system/ninjacore-api.service
```

Paste:

```ini
[Unit]
Description=NinjaCore Rust API
After=network.target
Before=ninjacore-web.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ninjacore

ExecStart=/path/to/ninjacore-api

# CPU affinity: cores 4-7
CPUAffinity=4-7

MemoryLimit=1G
MemoryAccounting=yes

Restart=on-failure
RestartSec=5s

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-api.service
sudo systemctl start ninjacore-api.service
```

### 3.3 Verify Unix Socket

```bash
ls -la /tmp/ninjacore.sock
# Should show socket with permissions 666

# Test connection
curl --unix-socket /tmp/ninjacore.sock http://localhost/api/clients
```

---

## Step 4: Setup Web Vitals Monitoring

### 4.1 Access Dashboard

Frontend automatically collects Web Vitals metrics.

View dashboard at:

```
http://5.78.214.176:3100/admin/vitals
```

This shows:
- ✓ FCP (First Contentful Paint)
- ✓ LCP (Largest Contentful Paint)
- ✓ CLS (Cumulative Layout Shift)
- ✓ INP (Interaction to Next Paint)
- ✓ TTFB (Time to First Byte)

### 4.2 Enable Analytics Endpoint

Update `src/lib/vitals.ts` to send metrics:

```ts
export function sendVital(vital: Vital) {
  // Send to backend
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify(vital),
  });
}
```

### 4.3 View Health Status

```bash
curl http://localhost:3100/api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-04T...",
  "uptime": 3600,
  "version": "1.0.0",
  "backend": {
    "unix_socket": "unix:///tmp/ninjacore.sock",
    "status": "ready"
  }
}
```

---

## Step 5: Setup for Scaling

### 5.1 Performance Baseline

Run load test from another machine:

```bash
# Using wrk (install: apt-get install wrk)
wrk -t4 -c100 -d30s http://5.78.214.176:3100/api/clients

# Expected results:
# Latency avg: <50ms
# Requests/sec: >1000
# Errors: 0
```

### 5.2 Monitor System

```bash
# Watch CPU/Memory
watch -n 1 'free -h && ps aux | grep ninjacore'

# Monitor services
sudo systemctl status ninjacore-web.service
sudo systemctl status ninjacore-api.service

# View logs
journalctl -u ninjacore-web.service -f
journalctl -u ninjacore-api.service -f
```

### 5.3 When to Scale

**Scale vertically (more resources) when:**
- CPU >70% sustained
- Memory >80% used
- Response time >100ms

**Scale horizontally (multiple servers) when:**
- Requests/sec >20k
- Need geographic distribution
- Single VPS maxes out

See **SCALE.md** for detailed scaling strategies.

---

## Testing Checklist

### Frontend

- [ ] Homepage loads at `/`
- [ ] Client list at `/clients` (loads all 3000+ rows)
- [ ] Search works instantly (Web Worker)
- [ ] Click client → detail page loads
- [ ] Bureau scores display correctly
- [ ] Letter generation streams progress
- [ ] PDF download works
- [ ] Web Vitals dashboard shows metrics

### Backend Integration

- [ ] Unix socket exists: `ls -la /tmp/ninjacore.sock`
- [ ] Health check: `curl http://localhost:3100/api/health`
- [ ] API endpoint: `curl http://localhost:3100/api/clients`
- [ ] Latency <1ms (Unix socket)

### Performance

- [ ] FCP <1s (skeleton loads)
- [ ] LCP <2.5s (data streams)
- [ ] INP <100ms (interactive)
- [ ] CLS <0.1 (stable)
- [ ] TTFB <50ms (edge cached)

### Operations

- [ ] systemd service auto-restarts on failure
- [ ] Logs readable: `journalctl -u ninjacore-web.service`
- [ ] Caddy reloads without downtime
- [ ] CPU affinity working: `taskset -pc $PID`

---

## Troubleshooting

### Frontend won't start

```bash
journalctl -u ninjacore-web.service -n 50
# Check for missing dependencies, port conflicts

# Port 3100 in use?
lsof -i :3100
sudo kill -9 <PID>

# Rebuild
bun run build
```

### API connection fails

```bash
# Check socket exists
ls -la /tmp/ninjacore.sock

# Check API is running
ps aux | grep ninjacore-api

# Test socket
curl --unix-socket /tmp/ninjacore.sock http://localhost/api/clients
```

### High latency

```bash
# Check CPU affinity
taskset -pc <PID>

# Check system load
uptime
top

# Monitor disk I/O
iostat -x 1
```

### Memory leak

```bash
# Monitor memory over time
watch -n 5 'ps aux | grep ninjacore'

# Restart service
sudo systemctl restart ninjacore-web.service
```

---

## Maintenance

### Daily

- Monitor `journalctl` for errors
- Check Web Vitals dashboard for regressions

### Weekly

- Backup SurrealDB: `surrealdb backup > backup.sql`
- Review system logs: `journalctl -u ninjacore-* -n 1000`
- Check disk space: `df -h`

### Monthly

- Update dependencies: `bun update`
- Review performance metrics
- Test failover/disaster recovery

### Quarterly

- Security updates: `apt-get update && apt-get upgrade`
- Database maintenance
- Performance optimization review

---

## Production Checklist

- [ ] Frontend deployed on VPS
- [ ] Reverse proxy (Caddy) configured
- [ ] Rust API running with Unix socket
- [ ] Web Vitals monitoring active
- [ ] Health checks passing
- [ ] Load test completed
- [ ] Error logging configured
- [ ] Backup strategy in place
- [ ] Domain DNS configured
- [ ] HTTPS certificate (Caddy auto-renews)
- [ ] Monitoring alerts set up
- [ ] Runbook created (this guide)

---

## Next Steps

1. **Deploy** (follow steps 1-5 above)
2. **Test** (run testing checklist)
3. **Monitor** (watch metrics for 1-2 weeks)
4. **Optimize** (tune based on metrics)
5. **Scale** (when ready, follow SCALE.md)

---

## Support

**Issues?** Check:

1. `journalctl -u ninjacore-web.service -n 50` (logs)
2. `curl http://localhost:3100/api/health` (health check)
3. `UNIX_SOCKET_SETUP.md` (backend integration)
4. `SCALE.md` (performance tuning)
5. `DEPLOY.md` (troubleshooting guide)

