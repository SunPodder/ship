# Architecture

This document describes how Ship is structured — what each layer does, how data flows from a browser request to the database and back, and where caching fits in.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser / Client                   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│              Next.js Frontend (apps/web)                │
│                                                         │
│  ┌───────────────┐   ┌────────────────┐                 │
│  │  App Router   │   │  Ship Admin UI  │                │
│  │  (pages/RSC)  │   │  (auto-gen)    │                 │
│  └───────┬───────┘   └───────┬────────┘                 │
│          │                   │                          │
│  ┌───────▼───────────────────▼────────┐                 │
│  │       Ship SDK (packages/sdk)       │                │
│  │  ship.post.findMany(), create()...  │                │
│  └───────────────────┬────────────────┘                 │
└──────────────────────│──────────────────────────────────┘
                       │ fetch() to API
┌──────────────────────▼──────────────────────────────────┐
│              Hono.js Backend (apps/api)                 │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │                  Middleware Stack                  │ │
│  │  Auth → RateLimit → CORS → Logging → Compression   │ │
│  └───────────────────────┬────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │              Ship CRUD Router                      │ │
│  │  /api/:model  →  Controller  →  Service            │ │
│  └───────────────────────┬────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │              Cache Layer (packages/cache)          │ │
│  │                                                    │ │
│  │   READ: Cache Hit?  ──Yes──→ return cached data    │ │
│  │              │ No                                  │ │
│  │              ▼                                     │ │
│  │   WRITE: fetch from DB → cache → return            │ │
│  │   MUTATE: write to DB → invalidate cache tags      │ │
│  └───────────────────────┬────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │         Mongoose ODM (packages/db)                 │ │
│  └───────────────────────┬────────────────────────────┘ │
└──────────────────────────│──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼────┐      ┌─────▼────┐
    │  MongoDB  │      │  Redis   │      │   S3/R2  │
    │ (primary) │      │ (cache)  │      │ (files)  │
    └───────────┘      └──────────┘      └──────────┘
```

---

## Monorepo Structure

Ship uses **pnpm workspaces** with **Turborepo** for fast parallel builds.

```
my-app/
├── apps/
│   ├── web/              # Next.js 15 (App Router)
│   └── api/              # Hono.js server
├── packages/
│   ├── core/             # Ship's core: defineModel, field types, DSL
│   ├── db/               # Mongoose models + connection manager
│   ├── cache/            # Redis / in-memory cache adapters
│   ├── sdk/              # Auto-generated typed client (used in web/)
│   ├── auth/             # JWT / session auth logic
│   ├── storage/          # File upload adapters
│   └── ui/               # Shared React component library (admin UI)
├── ship.config.ts         # Single source of truth: all models
├── ship.env.ts            # Env variable schema (Zod-validated)
├── turbo.json
└── package.json
```

---

## Layer Responsibilities

### `packages/core` — Model DSL

The heart of Ship. Provides `defineModel()` and all `field.*` types. At build-time, `ship generate` reads these model definitions and outputs real TypeScript files across the monorepo.

```
defineModel() definition
       │
       ├──→ Mongoose Schema (packages/db)
       ├──→ Zod validators (shared FE+BE)
       ├──→ Hono routes (apps/api)
       ├──→ Admin UI pages (apps/web)
       └──→ SDK methods (packages/sdk)
```

### `apps/api` — Hono.js Backend

- Thin, edge-compatible HTTP server
- Auto-generated CRUD routes live in `src/routes/<model>/`
- Custom business logic goes in `src/handlers/<model>/` — these are never overwritten by `ship generate`
- Middleware: auth, rate limiting, CORS, request logging
- Each route handler calls the **Service layer**, not the DB directly

**Route pattern:**

```
GET    /api/posts          → postService.list(query)
GET    /api/posts/:id      → postService.findById(id)
POST   /api/posts          → postService.create(body)
PATCH  /api/posts/:id      → postService.update(id, body)
DELETE /api/posts/:id      → postService.delete(id)
```

### `apps/web` — Next.js Frontend

- App Router with React Server Components (RSC)
- Admin UI is auto-generated but fully customizable
- Uses the `sdk` package for all data fetching
- Ship's RSC data fetching hooks are cache-aware (Next.js `cache()` + `revalidateTag()`)

### `packages/cache` — Cache Layer

This is what makes Ship fast. Every read operation goes through the cache layer before hitting the database. See [Caching System →](./caching.md) for full details.

**Two-level caching:**

| Level | Technology                | Scope                  | TTL                      |
| ----- | ------------------------- | ---------------------- | ------------------------ |
| L1    | In-process (LRU, Node.js) | Single server instance | Short (1–30s)           |
| L2    | Redis                     | All server instances   | Configurable (per model) |

### `packages/db` — Database Layer

- Mongoose 8: schema-based ODM with full TypeScript support
- Schemas are auto-generated from model definitions and compiled to Mongoose models
- No SQL migrations — Ship syncs **indexes** and **schema validators** to MongoDB with `ship db:sync`
- Embedded documents for tightly coupled sub-data (e.g. address inside User)
- References (`ObjectId` refs) for cross-collection relations populated via `.populate()`
- Supports read preference routing (primary vs secondaryPreferred) for replica sets

### `packages/sdk` — Typed Client

Auto-generated, fully typed API client. Provides:

```ts
// In Next.js Server Components
const posts = await ship.post.findMany({ ... })

// In Client Components / forms
const post = await ship.post.create({ ... })
```

---

## Request Lifecycle: Read (GET)

```
1. Browser → GET /api/posts?status=published&page=2

2. Hono middleware: verify auth token (if required by permissions)

3. Route handler: parse + validate query params via Zod

4. Service.list() called with parsed options

5. Cache Layer:
   - Compute cache key:  "posts:list:status=published:page=2"
   - Check Redis (L2):   HIT → return cached JSON, done ✓
   - Check memory (L1):  HIT → return cached JSON, done ✓
   - MISS → continue to DB

6. Mongoose: Post.find({ status: 'published' }).skip(20).limit(20).populate('author tags')

7. Result stored in Redis with TTL (e.g. 300s) + cache tags ["posts"]

8. Result stored in memory LRU (short TTL, e.g. 5s)

9. JSON response returned to client (ObjectIds serialized as hex strings)
```

## Request Lifecycle: Write (POST/PATCH/DELETE)

```
1. Browser → POST /api/posts (with body)

2. Auth middleware: must have 'editor' role (from model permissions)

3. Route handler: validate body via Zod schema

4. Service.create() called

5. Mongoose: await Post.create(data)

6. Cache Invalidation:
   - Purge all cache entries tagged "posts" from Redis
   - Purge memory LRU entries for this model

7. (Optional) Webhooks fired for registered listeners

8. New record returned as JSON
```

---

## Code Generation Strategy

`ship generate` produces files in two categories:

| Category            | Path pattern         | Overwritten on re-generate?  |
| ------------------- | -------------------- | ---------------------------- |
| **Generated** | `*.generated.ts`   | ✅ Yes — always overwritten |
| **Custom**    | `*.ts` (no suffix) | ❌ No — never touched       |

This means you can safely re-run `ship generate` after modifying your model — your custom business logic is preserved.

Example:

```
apps/api/src/routes/posts/
├── list.generated.ts      ← overwritten each time
├── list.ts                ← your custom overrides, never touched
├── create.generated.ts
├── create.ts
```

If `list.ts` exists, it takes precedence over `list.generated.ts`. The generated file is still kept as a reference.

---

## Edge Compatibility

The Hono.js backend is designed to run anywhere:

| Runtime            | Support                                 |
| ------------------ | --------------------------------------- |
| Node.js            | ✅ Full                                 |
| Bun                | ✅ Full                                 |
| Cloudflare Workers | ✅ (with KV or D1 adapters)             |
| Vercel Edge        | ✅ (with Edge-compatible cache adapter) |
| Deno               | ✅                                      |

The cache and DB adapters are swappable for edge environments (e.g., Cloudflare KV instead of Redis). Note: the MongoDB adapter requires a persistent connection and is not suited for stateless edge runtimes — use Cloudflare D1 or Turso for edge DB deployments.
