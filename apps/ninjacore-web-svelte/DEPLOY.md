# Deployment Guide - SvelteKit Frontend

## Quick Deploy

```bash
# From local machine
chmod +x deploy.sh
./deploy.sh root@5.78.214.176
```

## Manual Deployment

### Prerequisites

- Bun runtime on VPS
- Caddy reverse proxy
- systemd for service management
- Rust API running on Unix socket

### Step 1: Build

```bash
bun install
bun run build
# Output: dist/ (static files)
```

### Step 2: Upload to VPS

```bash
scp -r dist/ package.json bun.lock root@5.78.214.176:/opt/ninjacore/frontend/
```

### Step 3: Install on VPS

```bash
ssh root@5.78.214.176
cd /opt/ninjacore/frontend
bun install --production
```

### Step 4: Setup systemd Service

```bash
# Copy service file
sudo cp ninjacore-web.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-web.service
sudo systemctl start ninjacore-web.service

# Check status
sudo systemctl status ninjacore-web.service
```

### Step 5: Configure Caddy

```bash
# Copy Caddyfile
sudo cp Caddyfile /etc/caddy/

# Test config
sudo caddy validate --config /etc/caddy/Caddyfile

# Reload
sudo systemctl reload caddy
```

## Configuration

### Environment Variables

Create `.env.local` on VPS:

```bash
NODE_ENV=production
API_PORT=3100
API_HOST=0.0.0.0

# Unix socket to Rust API
RUST_API_ORIGIN=unix:///tmp/ninjacore.sock

# Frontend URL
VITE_API_BASE=https://api.ninjacore.ninjadispute.com
```

### Unix Socket Communication

The frontend connects to Rust backend via Unix socket:

```
SvelteKit (port 3100)
    ↓
Caddy (reverse proxy, port 80/443)
    ↓
Client browser
    ↓
HTTP to SvelteKit API routes
    ↓
Unix socket to Rust API (microsecond latency)
```

## Performance Tuning

### CPU Affinity

The systemd service pins to CPU cores 0-3:

```ini
CPUAffinity=0-3
```

Rust API should use cores 4-7:

```ini
CPUAffinity=4-7
```

### Memory Limits

```ini
MemoryLimit=512M
```

### Reverse Proxy Optimization

Caddy config includes:

- **Compression**: Zstd + Gzip
- **Caching**: Static assets cached 1 year (immutable)
- **HTTP/3**: QUIC for faster connections
- **Security headers**: HSTS, CSP, X-Frame-Options
- **Keep-alive**: Connection pooling to backend

## Monitoring

### View Logs

```bash
# Real-time logs
journalctl -u ninjacore-web.service -f

# Last 100 lines
journalctl -u ninjacore-web.service -n 100
```

### Web Vitals

Metrics are collected on the frontend:

- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **INP** (Interaction to Next Paint)
- **TTFB** (Time to First Byte)

View in browser console or send to analytics endpoint.

### Check Service Status

```bash
sudo systemctl status ninjacore-web.service
ps aux | grep bun
lsof -i :3100
```

## Troubleshooting

### Port Already in Use

```bash
sudo lsof -i :3100
sudo kill -9 <PID>
```

### Service Won't Start

```bash
sudo journalctl -u ninjacore-web.service -n 50
```

### Caddy Not Routing

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

### Unix Socket Connection Failed

```bash
# Check if socket exists
ls -la /tmp/ninjacore.sock

# Check if Rust API is running
ps aux | grep ninjacore-api
```

## Upgrades

### Update Frontend Code

```bash
# Pull latest
git pull origin main

# Rebuild
bun run build

# Upload new build
scp -r dist/ root@5.78.214.176:/opt/ninjacore/frontend/

# SSH and restart
ssh root@5.78.214.176 sudo systemctl restart ninjacore-web.service
```

### Update Dependencies

```bash
bun install --latest
bun run build
# Deploy as normal
```

## Performance Targets

After deployment, verify:

- **FCP**: < 1s (skeleton UI loads instantly)
- **LCP**: < 2.5s (data streams in)
- **INP**: < 100ms (virtual scroll is responsive)
- **CLS**: < 0.1 (fixed layouts)
- **TTFB**: < 50ms (edge cached)

## Scaling

For higher traffic:

1. **Load balancing**: Multiple SvelteKit instances with Caddy load balancer
2. **Caching**: Redis for session/data cache
3. **CDN**: Cloudflare or similar for static assets
4. **Unix socket pooling**: Connection pool to Rust API

## Rollback

If deployment fails:

```bash
# Stop the service
sudo systemctl stop ninjacore-web.service

# Restore previous build (if backed up)
cd /opt/ninjacore/frontend
git checkout previous-version
bun run build

# Restart
sudo systemctl start ninjacore-web.service
```
