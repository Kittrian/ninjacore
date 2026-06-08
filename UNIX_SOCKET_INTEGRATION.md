# Unix Socket Backend Integration

## Overview

The SvelteKit frontend is configured to communicate with the Rust backend via Unix domain sockets for sub-millisecond latency and zero TCP overhead.

## Configuration

### Environment Variables

```bash
# Unix socket path (default: /tmp/ninjacore.sock)
RUST_API_ORIGIN=unix:///tmp/ninjacore.sock

# Frontend server
API_PORT=3100
API_HOST=0.0.0.0

# Environment
NODE_ENV=production
```

### Frontend API Routes

The following routes forward requests to the Rust backend:

- `GET /api/clients` → `http://unix:///tmp/ninjacore.sock/api/clients`
- `GET /api/clients/:id` → `http://unix:///tmp/ninjacore.sock/api/clients/:id`
- `GET /api/health` → Checks backend connectivity

### Graceful Fallback

If the Unix socket is unavailable, the frontend:
1. Logs a warning: `Rust backend unavailable, using mock data`
2. Falls back to mock data for demonstration
3. Reports degraded status in `/api/health`

This allows the frontend to function independently while waiting for the backend to start.

## Testing Backend Connectivity

### Check Health Endpoint

```bash
curl http://5.78.214.176:3100/api/health
```

Response with connected backend:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-04T10:30:00.000Z",
  "uptime": 1234.5,
  "version": "1.0.0",
  "environment": "production",
  "frontend": {
    "status": "ready",
    "port": 3100
  },
  "backend": {
    "unix_socket": "unix:///tmp/ninjacore.sock",
    "status": "connected",
    "latency": 2
  }
}
```

Response with unavailable backend:

```json
{
  "status": "degraded",
  "backend": {
    "unix_socket": "unix:///tmp/ninjacore.sock",
    "status": "unavailable",
    "error": "Connection refused"
  }
}
```

### Test Socket Directly

```bash
# Check if socket exists and is listening
ls -lah /tmp/ninjacore.sock

# Test connection (requires netcat or socat)
echo -e "GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n" | nc -U /tmp/ninjacore.sock
```

## API Request Flow

```
Browser
  ↓
SvelteKit Frontend (Port 3100)
  ↓
API Routes (/api/clients, /api/clients/:id)
  ↓
Unix Socket (/tmp/ninjacore.sock)
  ↓
Rust Backend (Axum)
```

## Performance Characteristics

- **Latency**: <1ms per hop (Unix socket has ~0.1-0.5ms latency)
- **Throughput**: No TCP overhead, kernel handles efficiently
- **Memory**: Minimal per-connection overhead (no TCP state machine)
- **Scalability**: Can handle thousands of connections simultaneously

## Backend Requirements

The Rust backend must:

1. Listen on Unix socket: `/tmp/ninjacore.sock`
2. Expose HTTP endpoints:
   - `GET /api/health`
   - `GET /api/clients`
   - `GET /api/clients/:id`
   - `POST /api/letters/generate` (SSE streaming)

3. Ensure socket has proper permissions:
   ```bash
   # Should be readable/writable by frontend process
   srw-rw---- 1 root root 0 Jun  4 10:30 /tmp/ninjacore.sock
   ```

## Debugging

### Check Socket Status

```bash
# On VPS
stat /tmp/ninjacore.sock

# Check if anything is listening
ss -lnp | grep ninjacore
```

### Monitor Frontend Logs

```bash
# SSH into VPS
ssh root@5.78.214.176

# Check systemd service logs
systemctl logs ninjacore-web -n 100 -f

# Or use journalctl
journalctl -u ninjacore-web -n 100 -f
```

### Test API Endpoint

```bash
# Test clients endpoint with curl
curl -v http://5.78.214.176:3100/api/clients

# Test specific client
curl -v http://5.78.214.176:3100/api/clients/1
```

## Gradual Rollout

1. **Phase 1**: Backend sends health checks → frontend detects in `/api/health`
2. **Phase 2**: Backend handles read operations (`/api/clients`, `/api/clients/:id`)
3. **Phase 3**: Backend handles write operations (`/api/letters/generate`)
4. **Phase 4**: Monitor metrics in `/admin/vitals` dashboard

At each phase, the frontend maintains operation with mock data fallback.

## Security Considerations

- **Socket Permissions**: Only allow frontend process to access socket
- **User Isolation**: Consider running backend/frontend as separate users
- **Firewall**: Unix sockets are local-only, inherently isolated
- **No TLS Needed**: Unix socket communication is process-scoped

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Socket not found | Ensure Rust backend is running and socket created |
| Permission denied | Check socket permissions: `chmod 660 /tmp/ninjacore.sock` |
| Connection refused | Backend might not be listening; check backend logs |
| Slow responses | Check frontend CPU/memory; monitor with `top` |
| Frontend falls back to mock data | Backend unavailable; check status with `/api/health` |
