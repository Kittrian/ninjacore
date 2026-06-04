# NinjaCore Deployment Guide

## Quick Start (Docker Compose - Local)

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# Frontend: http://localhost:3100
# API: http://localhost:8080
# Database: http://localhost:8000 (SurrealDB)
```

## Local Development

### Terminal 1: Frontend
```bash
cd apps/ninjacore-web
npm install
NINJACORE_API_ORIGIN=http://localhost:8080 npm run dev
# Access at http://localhost:3000
```

### Terminal 2: Backend
```bash
cd ninjacore
cargo build --release
./target/release/ninjacore
# API at http://localhost:8080
```

### Terminal 3: Database
```bash
docker run -p 8000:8000 surrealdb/surrealdb:latest start --user root --pass change-me
```

## VPS Deployment (5.78.214.176)

### Prerequisites
- Docker and Docker Compose installed
- Root access via SSH

### Steps

1. **Copy files to VPS**
```bash
scp -r . root@5.78.214.176:/opt/ninjacore
```

2. **SSH into VPS**
```bash
ssh root@5.78.214.176
cd /opt/ninjacore
```

3. **Start Services**
```bash
docker-compose up -d
```

4. **Configure Caddy for HTTPS**
```bash
cat > /etc/caddy/Caddyfile <<'EOF'
ninjacore.ninjadispute.com {
  reverse_proxy localhost:3100
}

api.ninjacore.ninjadispute.com {
  reverse_proxy localhost:8080
}
EOF
systemctl restart caddy
```

5. **Verify**
```bash
curl http://localhost:3100
curl http://localhost:8080/api/health
```

## Environment Variables

### Frontend (.env.local)
```
NINJACORE_API_ORIGIN=http://localhost:8080
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

### Backend (.env)
```
BIND_ADDR=0.0.0.0:8080
SURREAL_URL=http://127.0.0.1:8000
SURREAL_NS=ninja
SURREAL_DB=dispute
SURREAL_USER=root
SURREAL_PASS=change-me
RUST_LOG=ninjacore=debug
```

## Health Checks

- **Frontend**: GET http://localhost:3100 (should return 200 OK with HTML)
- **API**: GET http://localhost:8080/api/health (should return 200 OK)
- **Database**: GET http://localhost:8000/health (should return 200 OK)

## Logs

```bash
# Docker Compose
docker-compose logs -f [service-name]

# Docker
docker logs -f [container-id]

# Local (backend)
RUST_LOG=debug cargo run --release
```

## Troubleshooting

### API returns 503
- Check if SurrealDB is running: `curl http://localhost:8000/health`
- Check API logs: `docker-compose logs ninjacore-api`

### Frontend can't reach API
- Verify API_ORIGIN environment variable
- Check if API container is healthy: `docker-compose ps`

### Port already in use
```bash
# Find process using port
lsof -i :3100
# Kill it
kill -9 [PID]
```
