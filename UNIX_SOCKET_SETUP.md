# Unix Socket Setup - SvelteKit ↔ Rust API

## Overview

This guide connects the SvelteKit frontend to the Rust Axum backend via Unix domain sockets for **microsecond latency** on the same VPS.

```
SvelteKit (port 3100, CPU 0-3)
    ↓ Unix socket (/tmp/ninjacore.sock)
Axum Backend (CPU 4-7)
    ↓
SurrealDB
```

## Step 1: Configure Rust Backend (Axum)

Update your Rust `main.rs` to listen on a Unix socket:

```rust
use axum::{
    routing::get,
    Router,
};
use std::os::unix::net::UnixListener;
use std::fs;

#[tokio::main]
async fn main() {
    // Remove existing socket
    let socket_path = "/tmp/ninjacore.sock";
    let _ = fs::remove_file(socket_path);

    // Create Unix socket listener
    let listener = UnixListener::bind(socket_path)
        .expect("Failed to bind Unix socket");

    // Set permissions
    fs::set_permissions(socket_path, std::fs::Permissions::from_mode(0o666))
        .expect("Failed to set socket permissions");

    let app = Router::new()
        .route("/api/clients", get(get_clients))
        .route("/api/clients/:id", get(get_client))
        .route("/api/letters/generate", post(generate_letter));

    // Convert to tokio listener
    let listener = tokio::net::UnixListener::from_std(listener)
        .expect("Failed to convert listener");

    println!("🔗 Backend listening on Unix socket: {}", socket_path);

    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
```

## Step 2: Update SvelteKit API Routes

Modify `src/routes/api/+layout.server.ts`:

```typescript
// Use Unix socket for server-side API calls
export async function POST({ request }) {
  const body = await request.json();
  
  // Server-side: Use Unix socket
  const response = await fetch('http://unix:/tmp/ninjacore.sock/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as any);

  return response.json();
}
```

## Step 3: Configure systemd Services

**SvelteKit (ninjacore-web.service)** - already configured, cores 0-3

**Rust API (ninjacore-api.service)** - create this:

```ini
[Unit]
Description=NinjaCore Rust API (Axum + Unix Socket)
After=network.target
Before=ninjacore-web.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/user/ninjacore

ExecStart=/path/to/ninjacore-api

# CPU affinity: cores 4-7
CPUAffinity=4-7

# Resource limits
MemoryLimit=1G
MemoryAccounting=yes

# Auto-restart
Restart=on-failure
RestartSec=5s

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Deploy:

```bash
sudo cp ninjacore-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ninjacore-api.service
sudo systemctl start ninjacore-api.service
```

## Step 4: Verify Connection

### Check if socket exists

```bash
ls -la /tmp/ninjacore.sock
```

### Test Unix socket connection

```bash
# Using curl (if available)
curl --unix-socket /tmp/ninjacore.sock http://localhost/api/clients

# Or from Node/Bun
const fs = require('fs');
const net = require('net');

const socket = net.createConnection('/tmp/ninjacore.sock');
socket.write('GET /api/clients HTTP/1.1\r\nHost: localhost\r\n\r\n');
socket.on('data', console.log);
```

### Monitor performance

```bash
# Watch Unix socket activity
watch -n 1 'netstat -x | grep ninjacore'

# Monitor CPU affinity
ps aux | grep ninjacore
taskset -pc $PID  # Shows CPU affinity
```

## Step 5: Load Testing

Test latency with `wrk` or `ab`:

```bash
# Test SvelteKit endpoint
wrk -t4 -c100 -d30s http://localhost:3100/api/clients

# Expected latency:
# - Browser → Caddy: <50ms (cached)
# - Caddy → SvelteKit: <5ms (localhost)
# - SvelteKit → Rust (Unix socket): <1ms
# - Total TTFB: ~50-60ms
```

## Performance Comparison

| Connection | Latency | Notes |
|-----------|---------|-------|
| HTTP TCP | 0.5-2ms | Same machine, port overhead |
| Unix Socket | <0.1ms | No TCP overhead, fastest |
| Network TCP | 5-50ms | Cross-machine, added latency |

## Troubleshooting

### Socket permission denied

```bash
sudo chmod 666 /tmp/ninjacore.sock
sudo chown root:root /tmp/ninjacore.sock
```

### "Connection refused"

```bash
# Check if backend is running
sudo systemctl status ninjacore-api.service

# Check socket is open
sudo lsof | grep ninjacore.sock
```

### High latency

```bash
# Verify CPU affinity is working
taskset -pc <PID>

# Check system load
top
htop

# Monitor context switches
vmstat 1
```

## Production Checklist

- [ ] Rust API listening on `/tmp/ninjacore.sock`
- [ ] Socket permissions set to 0o666
- [ ] systemd service configured with correct CPU affinity
- [ ] SvelteKit routes use Unix socket for API calls
- [ ] Memory limits set appropriately
- [ ] Logging configured (journalctl)
- [ ] Health check endpoint working
- [ ] Load test shows <1ms backend latency
- [ ] Monitoring in place (Web Vitals + systemd)

## Scaling Beyond Single Machine

If you need to scale:

1. **Multiple frontends**: Use TCP instead of Unix socket, add load balancer
2. **Multiple backends**: Implement connection pooling, use TCP
3. **CDN**: Cache static assets at edge, use for global distribution
4. **Read replicas**: Setup SurrealDB replication for failover

See SCALE.md for details.
