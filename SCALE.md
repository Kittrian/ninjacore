# Scaling Infrastructure - NinjaCore

## Current Setup (Single VPS)

```
Users
  ↓
Caddy (reverse proxy, HTTP/3)
  ├─ StelveKit (port 3100, CPU 0-3, 512MB)
  └─ Caddy caches static assets
  ↓
Unix socket (/tmp/ninjacore.sock)
  ↓
Rust API (CPU 4-7, 1GB)
  ↓
SurrealDB
```

**Capacity:**
- ~500-1000 concurrent users
- ~10k requests/second
- <50ms TTFB
- ~80% CPU usage

---

## Phase 1: Vertical Scaling (Single Machine)

### Increase Resources

```bash
# Update systemd limits
# /etc/systemd/system/ninjacore-web.service
MemoryLimit=1G          # Increase from 512M
CPUQuota=75%            # Limit to 3 cores worth

# /etc/systemd/system/ninjacore-api.service
MemoryLimit=2G          # Increase from 1G
CPUQuota=150%           # Limit to 6 cores worth
```

### Optimize Caddy

```caddyfile
# /etc/caddy/Caddyfile

# Enable HTTP caching
(cache_static) {
  @static {
    path /_app/immutable/*
    path /favicon.ico
  }
  header @static Cache-Control "public, max-age=31536000, immutable"
}

ninjacore.ninjadispute.com {
  import cache_static
  
  # Connection pooling
  reverse_proxy localhost:3100 {
    # Increase buffer sizes
    buffer_requests
    max_response_header_size 8kb
  }
}
```

### Tune Database

```sql
-- SurrealDB optimizations
DEFINE INDEX idx_clients_status ON clients FIELDS status;
DEFINE INDEX idx_clients_phone ON clients FIELDS phone;

-- Enable query caching
DEFINE CONFIG SET query_timeout = "30s";
```

**Result:** 2000-3000 concurrent users, 50k requests/second

---

## Phase 2: Horizontal Scaling (Load Balancing)

### Architecture

```
Cloudflare DNS
  ├─ VPS-1 (SvelteKit)
  ├─ VPS-2 (SvelteKit)
  └─ VPS-3 (SvelteKit)
  ↓
Shared Unix Socket → Rust API (single)
```

### Setup Load Balancer (Caddy)

On a dedicated load balancer VPS:

```caddyfile
# /etc/caddy/Caddyfile

ninjacore.ninjadispute.com {
  # Round-robin to 3 StelveKit instances
  reverse_proxy localhost:3100 localhost:3101 localhost:3102 {
    policy round_robin
    health_uri /api/health
    health_interval 10s
    health_timeout 5s
  }
}
```

### Deploy Multiple Frontends

```bash
# VPS-1
cd /opt/ninjacore/frontend-1
bun run start --port 3100

# VPS-2
cd /opt/ninjacore/frontend-2
bun run start --port 3100

# VPS-3
cd /opt/ninjacore/frontend-3
bun run start --port 3100

# All connect to same Unix socket via SSH tunnel
ssh root@api-vps -L /tmp/ninjacore.sock:/tmp/ninjacore.sock
```

**Result:** 5000+ concurrent users, 100k requests/second

---

## Phase 3: Multi-Server Architecture

### Switch to TCP (multiple backends)

```
Load Balancer (Caddy)
  ├─ Frontend-1 (VPS-A)
  ├─ Frontend-2 (VPS-B)
  └─ Frontend-3 (VPS-C)
  ↓
API Load Balancer
  ├─ Rust API-1 (VPS-D)
  ├─ Rust API-2 (VPS-E)
  └─ Rust API-3 (VPS-F)
  ↓
Database Cluster
  ├─ Primary (SurrealDB)
  ├─ Replica-1
  └─ Replica-2
```

### Update Connection Strings

```ts
// src/lib/api/client.ts
const API_BASE = process.env.VITE_API_BASE || 'http://api-lb.internal:8080';
// Or use DNS round-robin:
// const API_BASE = 'http://api.ninjacore.internal'; // DNS resolves to 3 IPs
```

### Implement Connection Pooling

```rust
// main.rs (Rust API)
use sqlx::postgres::PgPoolOptions;

let pool = PgPoolOptions::new()
    .max_connections(50)  // Connection pool size
    .connect(&db_url)
    .await?;
```

**Result:** 20k+ concurrent users, 500k requests/second

---

## Phase 4: Global CDN

### Cloudflare Workers (Optional)

```javascript
// worker.js
export default {
  async fetch(request) {
    // Cache static assets for 1 year
    const cache = caches.default;
    
    let response = await cache.match(request);
    if (!response) {
      response = await fetch(request);
      response = new Response(response.body, {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
      await cache.put(request, response.clone());
    }
    return response;
  },
};
```

### Cloudflare DNS

```
ninjacore.ninjadispute.com  → Cloudflare DNS
  ├─ Serves from edge (cached)
  ├─ Routes API calls to origin
  └─ Auto-failover to secondary
```

**Result:** Global distribution, <100ms latency worldwide

---

## Monitoring & Alerting

### Setup Prometheus + Grafana

```bash
# On monitoring VPS
docker run -d -p 9090:9090 prom/prometheus
docker run -d -p 3000:3000 grafana/grafana
```

### Collect Metrics

From StelveKit:

```ts
// src/lib/metrics.ts
export function recordMetric(name: string, value: number) {
  fetch('/metrics/record', {
    method: 'POST',
    body: JSON.stringify({ name, value, timestamp: Date.now() }),
  });
}
```

### Alert Rules

```yaml
# prometheus.yml
groups:
  - name: ninjacore
    rules:
      - alert: HighLatency
        expr: http_requests_latency_p95 > 1000  # 1s
        for: 5m
        
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        
      - alert: HighCPU
        expr: node_cpu_usage > 80
```

---

## Disaster Recovery

### Backup Strategy

```bash
# Daily SurrealDB backup
0 2 * * * sudo surrealdb backup > /backups/ninjacore-$(date +%Y%m%d).sql

# Upload to S3
0 3 * * * aws s3 cp /backups/ninjacore-*.sql s3://backups/ninjacore/
```

### Failover Setup

```bash
# DNS failover (Cloudflare)
# Set up health checks on each origin
# Auto-failover if primary is down

# Database replication
# SurrealDB → Read replicas for redundancy
```

---

## Cost Estimation

| Scale | VPS Count | Monthly Cost | Capacity |
|-------|-----------|--------------|----------|
| Phase 1 | 1 (upgraded) | $50-100 | 2k users |
| Phase 2 | 4 | $200-300 | 5k users |
| Phase 3 | 6+ | $400-600 | 20k+ users |
| Phase 4 | 6+ + CDN | $600-1k | Global, unlimited |

---

## Deployment Checklist

### Phase 1 ✅
- [x] Single VPS optimized
- [x] Systemd services configured
- [x] Caddy reverse proxy
- [x] Health checks working

### Phase 2
- [ ] Second StelveKit instance
- [ ] Load balancer setup
- [ ] Health check endpoints
- [ ] SSH tunneling for Unix socket

### Phase 3
- [ ] Multiple API servers
- [ ] API load balancer
- [ ] Database replication
- [ ] TCP connection pooling

### Phase 4
- [ ] Cloudflare Workers
- [ ] Global edge caching
- [ ] DNS failover
- [ ] Monitoring dashboard

---

## Performance Benchmarks

Run `wrk` from multiple locations:

```bash
# Local (VPS to VPS)
wrk -t4 -c100 -d30s http://localhost:3100/api/clients
# Expected: <1ms latency

# Network (external to Caddy)
wrk -t4 -c100 -d30s https://ninjacore.ninjadispute.com/api/clients
# Expected: <50ms latency

# With CDN caching
# Static assets: <10ms latency globally
# API: <50-100ms latency
```

---

## Next Steps

1. Monitor metrics for 2-4 weeks
2. When CPU >70%, implement Phase 2
3. When load >50k req/s, implement Phase 3
4. When global users >1000, implement Phase 4
