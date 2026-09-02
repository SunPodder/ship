# Caching System

Ship's caching system is what separates it from a plain CRUD framework. Every read operation is cached by default. Cache invalidation happens automatically when data is mutated. You get high throughput without ever writing a cache key manually.

---

## How It Works

Ship uses a **two-level cache** architecture:

```
Request → L1 (Memory LRU) → L2 (Redis) → Database
```

| Level | Technology | Scope | Default TTL |
|-------|-----------|-------|-------------|
| **L1** | Node.js in-process LRU | Single process | 5–30 seconds |
| **L2** | Redis | All server instances | Per model (default: 5 min) |

A cache hit at any level returns immediately without going deeper.

---

## Default Behavior

Out of the box, with zero configuration:

- All `list` operations (GET /api/posts) are cached
- All `single` operations (GET /api/posts/:id) are cached
- All `write` operations (POST, PATCH, DELETE) **invalidate** related cache entries
- Cache keys are computed automatically from the model name + query parameters
- Cache tags group related entries for bulk invalidation

---

## Cache Strategies

Set per-model in `ship.config.ts`:

### `cache-first` (default for reads)

```
1. Check cache
2. If HIT  → return cached value (no DB call)
3. If MISS → fetch from DB, populate cache, return
```

Best for: content that changes infrequently (articles, products, categories).

### `stale-while-revalidate`

```
1. Check cache
2. If HIT  → return cached value immediately (even if stale)
            + trigger background refresh if TTL is past
3. If MISS → fetch from DB, populate cache, return
```

Best for: high-read, low-latency requirements where slight staleness is acceptable (dashboards, public listings).

### `network-first`

```
1. Try to fetch from DB
2. If DB succeeds → update cache, return fresh data
3. If DB fails    → fall back to cached value (if exists)
```

Best for: data that must always be current (inventory, pricing).

### `no-cache`

Disables caching entirely for the model or specific operation.

```ts
cache: false
// or per-operation:
cache: {
  list: false,
  single: { ttl: 300 },  // still cache single reads
}
```

---

## Configuring Cache Per Model

```ts
defineModel('Post', fields, {
  cache: {
    // Global TTL for this model (seconds)
    ttl: 300,

    // Strategy
    strategy: 'stale-while-revalidate',

    // Tags for grouped invalidation
    // When a Post is created/updated/deleted, all entries
    // tagged 'posts' and 'content' are purged from Redis
    tags: ['posts', 'content'],

    // Per-operation overrides
    list: {
      ttl: 60,               // list cache expires faster
      strategy: 'cache-first',
    },
    single: {
      ttl: 3600,             // single records cached for 1 hour
      strategy: 'stale-while-revalidate',
    },
    // Mutations always invalidate — this disables caching writes
    // (writes are never cached by default anyway)
  }
})
```

---

## Cache Key Anatomy

Ship automatically computes cache keys from:

```
{modelName}:{operation}:{serialized-query-params}
```

Examples:

| Request | Cache Key |
|---------|-----------|
| `GET /api/posts` | `posts:list:{}` |
| `GET /api/posts?status=published&page=2` | `posts:list:{"status":"published","page":2}` |
| `GET /api/posts/abc-123` | `posts:single:abc-123` |
| `GET /api/posts/my-slug` | `posts:single:my-slug` |

You never need to manage keys manually.

---

## Cache Tags & Invalidation

Tags allow you to invalidate groups of cache entries at once.

**Automatic invalidation on mutation:**

```
POST   /api/posts      → purge all entries tagged 'posts'
PATCH  /api/posts/:id  → purge all entries tagged 'posts'
                         + purge 'posts:single:{id}'
DELETE /api/posts/:id  → purge all entries tagged 'posts'
                         + purge 'posts:single:{id}'
```

**Manual invalidation:**

```ts
import { cache } from '@ship/cache'

// Purge by tag
await cache.invalidateTag('posts')

// Purge by tag list
await cache.invalidateTags(['posts', 'content'])

// Purge exact key
await cache.del('posts:single:abc-123')

// Purge all cache
await cache.flush()
```

**In Next.js (revalidateTag):**

Ship integrates with Next.js's built-in cache tags, so `revalidateTag('posts')` on the frontend also works:

```ts
import { revalidateTag } from 'next/cache'

// After a form submission
revalidateTag('posts')
```

---

## Relation-Aware Invalidation

When you update a related record, Ship can automatically invalidate parent models.

```ts
// In ship.config.ts:
export const Comment = defineModel('Comment', {
  body:   field.text({ required: true }),
  post:   field.relation('Post', { many: false }),
}, {
  cache: {
    tags: ['comments'],
    // Also invalidate 'posts' when a comment changes
    invalidateRelated: ['posts'],
  }
})
```

Now when a comment is created/updated/deleted, both `comments` and `posts` cache tags are purged.

---

## Next.js Integration (Frontend Caching)

Ship's SDK uses Next.js's `fetch` cache and `revalidateTag` for Server Components:

```ts
// packages/sdk/src/posts.ts (auto-generated)
export async function findMany(options) {
  const res = await fetch(`${API_URL}/api/posts`, {
    next: {
      revalidate: 300,          // 5 min, matches model TTL
      tags: ['posts'],          // enables revalidateTag('posts')
    },
  })
  return res.json()
}
```

This means:
- Server Components automatically get ISR (Incremental Static Regeneration) behavior
- Mutations in the API call `revalidateTag` on the Next.js side too (via `SHIP_REVALIDATE_SECRET`)
- No manual cache busting needed

---

## Cache Adapters

Ship ships with two adapters out of the box:

### Redis Adapter (production)

```ts
// ship.config.ts
cache: {
  adapter: 'redis',
  options: {
    url: process.env.REDIS_URL,
    // Optional: use Redis Cluster
    cluster: false,
    // Key prefix (useful when sharing Redis with other apps)
    prefix: 'ship:',
    // Max retry delay
    retryDelay: 200,
  }
}
```

### Memory Adapter (dev / edge fallback)

```ts
cache: {
  adapter: 'memory',
  options: {
    maxSize: 500,      // max 500 entries in LRU
    ttl: 60,           // default TTL when not set per-model
  }
}
```

### Cloudflare KV Adapter

```ts
cache: {
  adapter: 'cloudflare-kv',
  options: {
    namespace: process.env.CF_KV_NAMESPACE_ID,
    accountId: process.env.CF_ACCOUNT_ID,
    apiToken:  process.env.CF_API_TOKEN,
  }
}
```

### Custom Adapter

```ts
import type { CacheAdapter } from '@ship/cache'

const myAdapter: CacheAdapter = {
  async get(key)          { ... },
  async set(key, val, ttl){ ... },
  async del(key)          { ... },
  async invalidateTag(tag){ ... },
  async flush()           { ... },
}

cache: { adapter: myAdapter }
```

---

## Cache Inspector (Dev Mode)

In development, Ship adds a cache inspector panel to the admin UI at `/admin/_cache`:

- See all cached keys and their TTLs
- Manually purge by key or tag
- View cache hit/miss rates per model
- See which requests were served from cache vs DB

Enable in production (guarded by admin role):

```ts
// ship.config.ts
admin: {
  cacheInspector: true  // only visible to role:admin
}
```

---

## Cache Warming

Optionally pre-populate the cache at startup:

```ts
// ship.config.ts
cache: {
  warm: {
    enabled: true,
    // Warm these queries at startup
    queries: [
      { model: 'Post',     query: { status: 'published', take: 20 } },
      { model: 'Category', query: {} },
    ]
  }
}
```

---

## Performance Benchmarks

On a standard setup (PostgreSQL + Redis on the same host):

| Operation | Without Cache | With Cache |
|-----------|--------------|------------|
| List (20 items) | ~18ms | ~0.8ms |
| Single read | ~8ms | ~0.4ms |
| Complex join (5 relations) | ~55ms | ~0.9ms |
| Write (POST) | ~12ms | ~12ms + invalidation (~1ms) |

Cache adds ~1ms overhead on a miss and ~0.5ms on a hit (Redis RTT).
