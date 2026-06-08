# NinjaCore Deployment Guide

## Overview

This guide covers the complete deployment flow from local development to live production on Local Dev Server 10.0.0.109.

**Deployment Flow:**
```
Your Mac                GitHub              Hetzner Server          Live Site
  ↓                      ↓                       ↓                      ↓
Edit & Test    →   Push Commit      →    Pull Code        →   Caddy Routes
                                      →    Build (split)   →   :443 HTTPS
                                      →    Restart services
```

---

## Quick Start

### Standard Deployment (All Components)
```bash
cd ~/NinjaTools
./deploy-to-live.sh all
```

### Frontend Only (Faster)
```bash
./deploy-to-live.sh frontend
```

### Backend Only
```bash
./deploy-to-live.sh backend
```

---

## What the Scripts Do

### `deploy-to-live.sh` — Complete Pipeline

**Steps:**
1. **Git Push** — Push current branch to GitHub
2. **SSH Connect** — Connect to server (Local Dev Server 10.0.0.109)
3. **Git Pull** — Fetch and checkout latest branch
4. **Build**
   - **Frontend**: `node build.mjs` (code-split CSS/JS)
   - **Backend**: `cargo build --release` (Rust compilation)
5. **Restart Services** — `systemctl restart <services>`
6. **Health Checks** — Verify services are running
7. **Verify** — Check commit hash and deployment status

**Usage:**
```bash
./deploy-to-live.sh [frontend|backend|all]
```

**Requirements:**
- `git` — for version control
- `sshpass` — for non-interactive SSH
  ```bash
  brew install sshpass
  ```

### `fix-surrealdb.sh` — Database Health & Recovery

**Checks:**
1. SurrealDB service status
2. HTTP connectivity to :8000
3. Authentication with default credentials
4. Database structure (namespace: ninja, database: dispute)
5. Backend reconnection to database

**Usage:**
```bash
./fix-surrealdb.sh
```

---

## Step-by-Step Manual Deployment

If you prefer to understand each step:

### 1. Local Development & Commit
```bash
cd ~/NinjaTools
git add -A
git commit -m "Your change description"
git push origin your-branch-name
```

### 2. Connect to Server
```bash
ssh root@5.78.214.176
# Password: Malachi77
cd /opt/ninjacore
```

### 3. Pull Latest Code
```bash
git fetch origin
git checkout your-branch-name
git pull origin your-branch-name
```

### 4a. Build Frontend (Code-Split)
```bash
cd FRONT-END
/root/.bun/bin/bun run build
# Output:
#   ✓ critical.css (1.1KB) - loaded immediately
#   ✓ deferred.css (124.5KB) - lazy loaded
#   ✓ Login bundle (2.5KB)
#   ✓ Billing bundle (6.5KB)
#   ✓ Payments bundle (19.5KB)
#   ✓ Core app (138.6KB)
```

### 4b. Build Backend (Rust)
```bash
cd /opt/ninjacore/ninjacore
/root/.cargo/bin/cargo build --release
# Takes 2-5 minutes
```

### 5. Restart Services
```bash
# Frontend
systemctl restart ninja-auth ninjacore-frontend

# Backend
systemctl restart ninjacore

# All
systemctl restart ninja-auth ninjacore ninjacore-frontend surrealdb
```

### 6. Verify Status
```bash
systemctl status ninjacore-frontend --no-pager
systemctl status ninjacore --no-pager
```

### 7. Check Logs
```bash
journalctl -u ninjacore-frontend.service -n 30 --no-pager
journalctl -u ninjacore.service -n 30 --no-pager
```

---

## Services & Ports

### Frontend
- **Service**: `ninjacore-frontend.service`
- **Port**: `:3000` (localhost only)
- **Process**: `node /opt/ninjacore/server.mjs`
- **Type**: Code-split static server

### Backend
- **Service**: `ninjacore.service`
- **Port**: `:3019` (localhost only)
- **Process**: `/opt/ninjacore/ninjacore/target/release/ninjacore`
- **Type**: Rust Axum HTTP server

### OAuth/SSO
- **Service**: `ninja-auth.service`
- **Port**: `:4001` (localhost only)
- **Process**: `node /home/ninja/auth-server/src/index.mjs`
- **Providers**: Google, GitHub, Apple

### Database
- **Service**: `surrealdb.service`
- **Port**: `:8000` (all interfaces)
- **Data**: `/var/lib/surrealdb/`
- **Namespace**: `ninja`
- **Database**: `dispute`
- **Credentials**: `root` / `change-me`

### Reverse Proxy
- **Service**: `caddy.service`
- **Ports**: `:80` (HTTP) → `:443` (HTTPS)
- **Domains**:
  - `ninjacore.ninjadispute.com` → `:3000` (frontend)
  - `auth.ninjadispute.com` → `:4001` (OAuth)
- **SSL**: Let's Encrypt (auto-renew)

---

## Code-Split Asset Strategy

Why code-splitting matters:

### Critical Path (Loads First)
- **critical.css** (1.1KB) — inline in HTML
- Essential styling for initial paint

### Lazy-Loaded (After Page Load)
- **deferred.css** (124.5KB) — loads async
- Feature-specific CSS

### JavaScript Bundles (On-Demand)
- **login.js** (2.5KB) — login page
- **billing.js** (6.5KB) — billing page
- **payments.js** (19.5KB) — payments page
- **app.js** (138.6KB) — main application

**Benefits:**
- ✅ Faster first paint (smaller initial HTML)
- ✅ Smaller initial payload
- ✅ Only load code for pages user visits
- ✅ Browser caching works better

---

## Troubleshooting

### Frontend Not Loading
```bash
# Check service is running
systemctl status ninjacore-frontend --no-pager

# Check port is listening
netstat -tuln | grep 3000

# Check logs
journalctl -u ninjacore-frontend.service -n 50 --no-pager

# Restart
systemctl restart ninjacore-frontend
```

### Backend Returning 500 Errors
```bash
# Check service status
systemctl status ninjacore --no-pager

# Check logs for SurrealDB connection error
journalctl -u ninjacore.service -n 50 --no-pager

# Run health check script
./fix-surrealdb.sh

# Manual SurrealDB check
curl -u root:change-me -X POST http://127.0.0.1:8000/sql \
  -H 'Content-Type: application/json' \
  -d 'SELECT 1'
```

### SurrealDB Connection Failed
```bash
# Restart database
systemctl restart surrealdb && sleep 5

# Verify it's running
systemctl status surrealdb --no-pager

# Restart backend to reconnect
systemctl restart ninjacore

# Run full health check
./fix-surrealdb.sh
```

### Git Changes Won't Pull
```bash
# Clean up untracked files on server
cd /opt/ninjacore
git clean -fd
git reset --hard origin/branch-name

# Retry pull
git pull origin branch-name
```

---

## Environment Variables

The services use these environment variables:

```bash
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
ORIGIN=https://ninjacore.ninjadispute.com

# Database
SURREALDB_URL=http://127.0.0.1:8000
SURREALDB_USER=root
SURREALDB_PASS=change-me

# OAuth
GOOGLE_CLIENT_ID=...
GITHUB_CLIENT_ID=...
APPLE_CLIENT_ID=...

# Deployment
CPU_AFFINITY=0-3 (frontend)
CPU_AFFINITY=4-7 (backend)
```

---

## Performance Monitoring

### Watch Deployment
```bash
watch -n 1 'systemctl status ninjacore-frontend ninjacore --no-pager | grep -E "Active|Memory|CPU"'
```

### Check Memory Usage
```bash
ps aux | grep -E "node|ninjacore|surrealdb" | grep -v grep
```

### View Build Artifacts
```bash
ls -lh /opt/ninjacore/public/
ls -lh /opt/ninjacore/public/*.css
ls -lh /opt/ninjacore/public/*.js
```

### Monitor Disk Space
```bash
df -h /opt/ninjacore
du -sh /opt/ninjacore/*
```

---

## Backup Before Deployment

The deployment script backs up your code before pulling:

```bash
# Manual backup
cd /opt/ninjacore
tar czf /backup/ninjacore-$(date +%Y%m%d-%H%M%S).tar.gz .
```

---

## Rollback to Previous Version

If something breaks:

```bash
# List recent commits
git log --oneline -10

# Revert to specific commit
git reset --hard <commit-hash>
git push origin your-branch-name --force

# Then deploy
./deploy-to-live.sh all
```

---

## Git Branch Strategy

- **`main`** — Stable production code
- **`claude/code-splitting-refactor-D0Vt5`** — Current frontend (code-split)
- **`claude/nextjs-15-frontend-P13iC`** — Old frontend (experimental)
- Feature branches — Work in progress

**Deploy from any branch:**
```bash
git checkout your-branch
./deploy-to-live.sh all
# Script pushes current branch to GitHub and deploys
```

---

## Server Specs

- **Provider**: Hetzner Cloud
- **OS**: Ubuntu 26.04 LTS
- **CPU**: 8 cores (Core 0-3: frontend, Core 4-7: backend)
- **RAM**: 16GB
- **Disk**: 150GB SSD (46GB used)
- **IP**: 5.78.214.176

---

## Common Deploy Patterns

### Just Fixed Frontend CSS
```bash
git add FRONT-END/src
git commit -m "Fix: update client list styles"
./deploy-to-live.sh frontend
```

### Deployed New Backend Route
```bash
git add ninjacore/src
git commit -m "feat: add new API endpoint"
./deploy-to-live.sh backend
```

### Full App Update
```bash
git add -A
git commit -m "chore: update frontend and backend"
./deploy-to-live.sh all
```

---

## Notes

- SSH password: `Malachi77`
- Database password: `change-me`
- Services auto-restart on failure (RestartSec=3)
- Logs are kept by systemd (use `journalctl`)
- Caddy handles HTTPS/HTTP3 automatically
- Code-splitting reduces initial page load significantly

---

## For More Help

```bash
# SSH into server directly
ssh root@5.78.214.176

# View real-time logs
journalctl -u ninjacore-frontend.service -f

# Check all services
systemctl status ninjacore* ninja-auth surrealdb caddy

# Monitor resources
top -u root
```

---

**Last Updated**: June 5, 2026
**Deployment Status**: ✅ Ready
