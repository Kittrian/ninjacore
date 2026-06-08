# 🚀 Automatic Deployment Guide

## Quick Start

### Build & Deploy in One Command
```bash
npm run build:deploy
```

This will:
1. ✅ Build optimized assets with code splitting
2. ✅ Deploy to Hetzner production
3. ✅ Restart the service
4. ✅ Verify deployment

---

## Available Commands

### Manual Build Only
```bash
npm run build
```
Creates optimized bundles in `/dist/` but doesn't deploy yet.

### Manual Deploy
```bash
npm run deploy
# OR
./deploy.sh
```
Deploys pre-built assets from `/dist/` to production.

### Build & Deploy
```bash
npm run build:deploy
```
One-step: build then deploy.

---

## Automatic Deployments

### On Git Pull
When you `git pull` and source files changed:
```bash
git pull
# Automatically triggers:
# 1. npm run build
# 2. ./deploy.sh
```

The post-merge hook detects changes to:
- `.js` files
- `.css` files  
- `index.html`
- `build.mjs`

If no source files changed, deployment is skipped.

---

## Deployment Details

### What Gets Deployed

```
/dist/
├── critical.css          ⚡ (1.1KB) - loads first
├── deferred.css         📦 (124.5KB) - lazy-loaded
├── app.bundle.js        📦 (138.6KB)
├── billing.bundle.js    📦 (6.5KB)
├── login.bundle.js      📦 (2.5KB)
├── payments.bundle.js   📦 (19.5KB)
├── *.map                📋 (sourcemaps)
└── *.html               📄 (copied)

index.html              📄 (updated for code splitting)
lazy-loader.js          🎯 (handles lazy loading)
```

### Deployment Flow

```
Local Build → Hetzner Sync → index.html Deploy → lazy-loader Deploy → Service Restart
```

### Service Restart
The deployment script automatically:
1. Syncs `/dist/` files
2. Updates `index.html`
3. Updates `lazy-loader.js`
4. Restarts `ninjacore-web.service`
5. Verifies service is running

---

## Environment Variables

The deploy script uses these credentials (auto-loaded):

```bash
REMOTE_USER="root"
REMOTE_HOST="5.78.214.176"
REMOTE_APP_DIR="/home/ninjacore/htdocs/ninjacore.ninjadispute.com"
```

SSH access via `sshpass` with password from `~/.bashrc`

---

## Performance Benefits

| Metric | Before | After |
|--------|--------|-------|
| **Initial CSS** | 7.4MB | 1.1KB |
| **Critical Path** | 8.2MB | 1.1KB |
| **Time to Interactive** | 3-4s | 0.5s |
| **Improvement** | — | **6-8x faster** |

---

## Troubleshooting

### "Build failed"
```bash
npm run build
# Check for errors, fix code, then:
npm run build:deploy
```

### "Deployment failed"
```bash
# Check SSH access
ssh root@5.78.214.176 echo "OK"

# Check sshpass password
echo $VPS1_PASS

# Manual deploy
./deploy.sh
```

### "Service won't restart"
```bash
ssh root@5.78.214.176 systemctl status ninjacore-web.service
```

---

## Git Hooks

### Enabled
- ✅ `post-merge` - Auto-deploy on `git pull` if source changed
- ✅ `post-commit` - Ready (commented out, uncomment to enable)

### Enable Auto-Deploy on Every Commit
```bash
# Uncomment the auto-deploy line in .git/hooks/post-commit
sed -i 's/^# echo/echo/' .git/hooks/post-commit
```

---

## Next Steps

1. **Test a change**: Edit a file, commit, push to see auto-deploy
2. **Monitor deploys**: Check service logs after deployment
3. **Set up monitoring**: Watch load times improve

---

## Support

For issues or questions:
```bash
npm run build   # See build errors
./deploy.sh     # See deploy errors
```

Deployment logs are output to console in real-time.
