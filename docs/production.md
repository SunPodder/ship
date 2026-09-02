# Production & Deployment

This guide covers deploying Ship to production — environment setup, Docker, performance tuning, and health checks.

---

## Production Checklist

Before deploying:

- [ ] All environment variables set and validated
- [ ] `MONGODB_URI` points to production MongoDB (Atlas or self-hosted replica set)
- [ ] `REDIS_URL` points to production Redis
- [ ] `JWT_SECRET` is a strong random string (32+ chars)
- [ ] CORS origins configured to match your domain(s)
- [ ] File storage configured (S3 or R2, not local)
- [ ] Email adapter configured (not `log`)
- [ ] Rate limiting tuned for production traffic
- [ ] Indexes synced: `ship db:sync`
- [ ] Cache warming configured if needed

---

## Docker

Ship comes with production-ready Dockerfiles.

### `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/*/package.json packages/*/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### `apps/web/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
# ... (standard Next.js standalone Dockerfile)
# Ship generates this for you via `ship create`

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

### `docker-compose.yml` (production)

```yaml
version: '3.9'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      MONGODB_URI: ${MONGODB_URI}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: https://api.myapp.com
    ports:
      - "3000:3000"
    restart: unless-stopped

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE:      myapp
    restart: unless-stopped
    # For production, use a replica set (required for transactions):
    command: mongod --replSet rs0 --bind_ip_all

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

---

## Deployment Targets

### Vercel (Web) + Fly.io (API)

The recommended setup for most teams:

**Web → Vercel:**
```bash
# In apps/web/
vercel deploy --prod
```

**API → Fly.io:**
```bash
# In apps/api/
fly launch
fly secrets set MONGODB_URI=... JWT_SECRET=... REDIS_URL=...
fly deploy
```

> **Recommended DB**: Use **MongoDB Atlas** (managed, free tier available) instead of self-hosting MongoDB on Fly.io.

### Cloudflare (Edge)

For ultra-low latency globally:

**API → Cloudflare Workers:**
```bash
ship build --target cf-workers
wrangler deploy
```

**Cache:** Uses Cloudflare KV (configure `cache.adapter: 'cloudflare-kv'`)
**DB:** MongoDB doesn't run on CF Workers — use MongoDB Atlas with connection via HTTP Data API, or switch to Cloudflare D1 for edge-native SQL.

### Railway

One-click deploy:

```bash
railway up
```

Railway auto-detects the monorepo and deploys both services. Set env vars in the Railway dashboard.

### Self-hosted (VPS)

```bash
# On your VPS:
git clone your-repo
cd your-repo
cp .env.example .env.production
# Edit .env.production

docker-compose -f docker-compose.prod.yml up -d
ship db:sync --env .env.production
```

---

## Index Sync in Production

MongoDB doesn't use SQL migrations. Instead, run `ship db:sync` to push index changes:

```bash
# CI/CD step before deploying
ship db:sync --env .env.production

# Or sync on startup (configure in ship.config.ts):
# database: { sync: { autoSync: true } }
```

> ⚠️ Dropping an index on a large collection can impact performance. Use `--background: true` (already default in Ship) to avoid blocking reads.

---

## Horizontal Scaling

Ship's API is stateless — scale horizontally freely.

**Requirements for multiple API instances:**
- ✅ MongoDB handles concurrent connections via the driver connection pool (`maxPoolSize`)
- ✅ **MongoDB Atlas** supports horizontal read scaling with secondaryPreferred read preference
- ✅ Redis is shared across all instances (cache consistency guaranteed)
- ✅ File uploads go to S3/R2 (not local disk)
- ✅ Session store is Redis (not memory)
- ⚠️ MongoDB transactions require a **replica set** (Atlas provides this; for self-hosted, configure `--replSet`)

**Recommended for high traffic:**

```
                     ┌─────────────┐
                     │  Load Balancer  │
                     └──────┬──────┘
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
   │   API #1    │   │   API #2    │   │   API #3    │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          └─────────────────┼──────────────────┘
                      ┌─────┴──────┐
                 ┌─────────┐  ┌─────────┐
                 │ MongoDB  │  │  Redis  │
                 │ (Atlas)  │  │(shared)│
                 └─────────┘  └─────────┘
```

---

## Health Check

```
GET /health

{
  "status": "ok",
  "version": "0.1.0",
  "database": "connected",
  "cache": "connected",
  "uptime": 3600
}
```

Returns `503` if database or cache is unreachable.

---

## Performance Tuning

### MongoDB

```
# mongod.conf (self-hosted)
net:
  maxIncomingConnections: 200

storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1       # set to ~50% of available RAM

operationProfiling:
  slowOpThresholdMs: 100   # log slow queries
  mode: slowOp
```

**Atlas settings:**
- Enable **Performance Advisor** — auto-suggests missing indexes
- Set **Read Preference** to `secondaryPreferred` for read-heavy workloads
- Enable **Atlas Search** for full-text search without Meilisearch

### Redis

```conf
# redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
save ""   # disable RDB snapshots for cache-only Redis
```

### Mongoose Connection Pool

Tune the pool size in `ship.config.ts`:

```ts
database: {
  uri:     process.env.MONGODB_URI,
  options: {
    maxPoolSize:  20,   // increase for high-concurrency
    minPoolSize:  5,
    socketTimeoutMS: 45_000,
  }
}
```

---

## Logging

In production, Ship outputs structured JSON logs:

```json
{
  "level": "info",
  "method": "GET",
  "path": "/api/posts",
  "status": 200,
  "duration": 4,
  "cacheHit": true,
  "requestId": "req-abc123",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

Configure log level:

```ts
// ship.config.ts
api: {
  logging: {
    level:  'info',       // 'debug' | 'info' | 'warn' | 'error'
    format: 'json',       // 'json' | 'pretty'
    // Send logs to an external service:
    transport: {
      type: 'axiom',
      token: process.env.AXIOM_TOKEN,
      dataset: process.env.AXIOM_DATASET,
    }
  }
}
```

---

## Zero-Downtime Deploys

1. **Build new containers** (don't stop old ones yet)
2. **Sync indexes** (`ship db:sync`) — new indexes are built in the background
3. **Deploy new containers** behind load balancer
4. **Old containers** drain connections and shut down

For breaking field changes, use a **two-phase schema evolution**:
1. Deploy code that supports both old and new field shapes (read-both)
2. Run a data migration script to backfill the new field
3. Deploy code that only uses the new field shape
4. Drop the old field (optional cleanup)
