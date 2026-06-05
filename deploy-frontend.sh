#!/bin/bash

HETZNER_HOST="5.78.214.176"
HETZNER_PASS="Malachi77"

echo "🚀 DEPLOYING FRONTEND"
echo "====================="

# Copy frontend files to Hetzner
echo "Deploying frontend to /opt/ninjacore-web..."

sshpass -p "$HETZNER_PASS" ssh -o StrictHostKeyChecking=no root@$HETZNER_HOST << 'DEPLOY'
# Create frontend directory
mkdir -p /opt/ninjacore-web

# Copy built files (public + static assets)
# For now, use the existing public directory that's already on the server
cp -r /opt/ninjacore/public/* /opt/ninjacore-web/ 2>/dev/null || true
cp /opt/ninjacore/index.html /opt/ninjacore-web/ 2>/dev/null || true
cp /opt/ninjacore/app.js /opt/ninjacore-web/ 2>/dev/null || true
cp /opt/ninjacore/*.css /opt/ninjacore-web/ 2>/dev/null || true

# Create a simple Node.js server to serve the frontend
cat > /opt/ninjacore-web/server.js << 'SERVER'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const publicDir = __dirname;

const server = http.createServer((req, res) => {
  // Remove query string
  let filePath = decodeURIComponent(req.url).split('?')[0];
  if (filePath === '/') filePath = '/index.html';

  filePath = path.join(publicDir, filePath);

  // Security check
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Try to serve file
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(publicDir, 'index.html');
      fs.readFile(indexPath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      });
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      });
      return;
    }

    // Serve file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
        return;
      }

      // Determine content type
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'application/font-woff',
        '.woff2': 'application/font-woff2',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Frontend server running on http://127.0.0.1:${PORT}`);
});
SERVER

chmod +x /opt/ninjacore-web/server.js

echo "✅ Frontend deployed to /opt/ninjacore-web"
DEPLOY

echo ""
echo "✅ Frontend deployment complete"

# Update Caddy to route to frontend
echo ""
echo "Updating Caddy configuration..."

sshpass -p "$HETZNER_PASS" ssh -o StrictHostKeyChecking=no root@$HETZNER_HOST << 'CADDY'
cat > /etc/caddy/Caddyfile << 'CADDYFILE'
ninjacore.ninjadispute.com {
    # Frontend (Node.js server on port 3000)
    reverse_proxy localhost:3000 {
        flush_interval -1
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
        header_up X-Forwarded-For {remote_host}
    }

    # API routes to Unix socket backend
    @api path /api/*
    reverse_proxy @api unix//run/ninjacore/ninjacore.sock {
        flush_interval -1
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
        header_up X-Forwarded-For {remote_host}
    }

    # Enable HTTP/3
    encode gzip
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}

# Auth server
auth.ninjadispute.com {
    reverse_proxy localhost:4001 {
        flush_interval -1
    }
}

# API gateway (old backend)
api.ninjadispute.com {
    reverse_proxy localhost:3003 {
        flush_interval -1
    }
}
CADDYFILE

# Validate
caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
systemctl reload caddy

echo "✅ Caddy configuration updated"
CADDY

echo ""
echo "Starting frontend server..."

sshpass -p "$HETZNER_PASS" ssh -o StrictHostKeyChecking=no root@$HETZNER_HOST << 'START'
# Start frontend if not running
nohup node /opt/ninjacore-web/server.js > /opt/ninjacore-web/server.log 2>&1 &

# Give it a moment to start
sleep 2

# Verify
echo "Frontend status:"
ps aux | grep "node /opt/ninjacore-web" | grep -v grep || echo "Starting..."

echo ""
echo "Testing frontend..."
curl -s http://127.0.0.1:3000/ | head -c 200
echo ""
START

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║    ✅ FRONTEND DEPLOYMENT COMPLETE ✅      ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Frontend: https://ninjacore.ninjadispute.com"
echo "Status: Should now be live!"

