# Backend (Hono.js)

Ship's backend lives in `apps/api/` and is powered by Hono.js — an ultra-fast, edge-compatible web framework. Ship generates all the boilerplate; you focus on custom business logic.

---

## Why Hono?

| Feature | Benefit |
|---------|---------|
| ~14KB bundle size | Faster cold starts |
| Edge-native | Runs on CF Workers, Deno Deploy, Bun, Node |
| Built-in middleware | Auth, CORS, rate limiting, logging |
| Typed routing | End-to-end TypeScript |
| OpenAPI support | Auto-generated docs via `@hono/zod-openapi` |

---

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Entry point — mounts all routers
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification
│   │   ├── rate-limit.ts     # Per-IP / per-user rate limiting
│   │   ├── cors.ts           # CORS policy
│   │   └── logger.ts         # Request logging
│   ├── routes/               # Auto-generated route handlers
│   │   ├── posts/
│   │   │   ├── list.generated.ts
│   │   │   ├── list.ts           # Your custom overrides (optional)
│   │   │   ├── get.generated.ts
│   │   │   ├── create.generated.ts
│   │   │   ├── update.generated.ts
│   │   │   └── delete.generated.ts
│   │   └── [other-models]/
│   ├── services/             # Business logic (auto-gen + your code)
│   │   ├── post.service.generated.ts
│   │   └── post.service.ts       # Your extensions
│   ├── handlers/             # Custom route handlers (never overwritten)
│   │   └── posts/
│   │       └── publish.ts
│   └── lib/
│       ├── errors.ts         # ShipError class
│       └── response.ts       # Standard response helpers
├── package.json
└── tsconfig.json
```

---

## Entry Point

```ts
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { compress } from 'hono/compress'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { shipRoutes } from './routes'     // auto-generated

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', compress())
app.use('/api/*', cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }))
app.use('/api/*', rateLimitMiddleware())
app.use('/api/*', authMiddleware())

// Auto-generated CRUD routes
app.route('/api', shipRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }))

export default app
```

---

## Middleware

### Auth Middleware

```ts
// middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verifyJWT } from '@ship/auth'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (token) {
    try {
      const user = await verifyJWT(token)
      c.set('user', user)   // available as c.get('user') in handlers
    } catch {
      // Invalid token — not setting user, let permission layer handle it
    }
  }

  await next()
})
```

### Rate Limiting

```ts
// middleware/rate-limit.ts
import { createRateLimiter } from '@ship/middleware'

export const rateLimitMiddleware = createRateLimiter({
  // Global default
  windowMs: 60_000,         // 1 minute
  max: 100,                 // 100 requests per minute per IP

  // Authenticated users get a higher limit
  authenticatedMax: 500,

  // Per-route overrides
  routes: {
    'POST /api/auth/login': { max: 5, windowMs: 60_000 },
    'POST /api/*':          { max: 50 },
  },

  // Store in Redis for distributed rate limiting
  store: 'redis',
})
```

### Request Logging

Ship's logger outputs structured JSON in production and pretty-printed in dev:

```ts
// Production log line:
{
  "level": "info",
  "method": "GET",
  "path": "/api/posts",
  "status": 200,
  "duration": 4,
  "cacheHit": true,
  "userId": "user-123",
  "requestId": "req-abc",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

---

## Generated Route Handler

Here's what a generated list handler looks like (simplified):

```ts
// routes/posts/list.generated.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { postListQuerySchema } from '@ship/db/schema/posts'
import { postService } from '../../services/post.service'
import { requirePermission } from '@ship/auth'
import { ok, paginated } from '../../lib/response'

const app = new Hono()

app.get('/',
  requirePermission('posts', 'list'),
  zValidator('query', postListQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    const user  = c.get('user')

    const result = await postService.list(query, { user })

    return c.json(paginated(result))
  }
)

export default app
```

---

## Writing Custom Handlers

Never edit generated files directly — create custom handlers instead:

```ts
// handlers/posts/publish.ts
import { Hono } from 'hono'
import { requireRole } from '@ship/auth'
import { postService } from '../../services/post.service'
import { ok, notFound } from '../../lib/response'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const app = new Hono()

const publishSchema = z.object({
  publishedAt: z.string().datetime().optional(),
  notifySubscribers: z.boolean().default(false),
})

// POST /api/posts/:id/publish
app.post('/:id/publish',
  requireRole('editor'),
  zValidator('json', publishSchema),
  async (c) => {
    const id   = c.req.param('id')
    const body = c.req.valid('json')
    const user = c.get('user')

    const post = await postService.findById(id)
    if (!post) return c.json(notFound('Post'), 404)

    const published = await postService.publish(id, {
      publishedAt: body.publishedAt ?? new Date().toISOString(),
      publishedBy: user.id,
    })

    if (body.notifySubscribers) {
      await emailService.notifySubscribers(published)
    }

    return c.json(ok(published))
  }
)

export default app
```

Register custom handlers in `src/index.ts`:

```ts
import postPublish from './handlers/posts/publish'
app.route('/api/posts', postPublish)
```

---

## Response Helpers

```ts
import { ok, created, paginated, notFound, badRequest, unauthorized } from '@ship/api'

// 200 OK
return c.json(ok(data))

// 201 Created
return c.json(created(data), 201)

// 200 with pagination meta
return c.json(paginated({ data, total, page, limit }))

// 404 Not Found
return c.json(notFound('Post'), 404)

// 400 Bad Request
return c.json(badRequest('Invalid slug format'), 400)

// 401
return c.json(unauthorized(), 401)
```

All responses follow the same envelope shape:

```json
// Success
{ "data": { ... }, "meta": { ... } }

// Error
{ "error": "ERROR_CODE", "message": "Human readable message", "fields": { ... } }
```

---

## Error Handling

```ts
import { ShipError } from '@ship/core'

// Throw from anywhere in a service or handler
throw new ShipError('INSUFFICIENT_STOCK', 'Not enough stock available', {
  status: 400,
  fields: { quantity: ['Requested quantity exceeds available stock'] },
})
```

Ship has a global error handler in `src/index.ts` that catches `ShipError` instances and formats them properly.

---

## OpenAPI / Swagger

Ship auto-generates an OpenAPI 3.1 spec from your model definitions:

```
GET /docs        → Swagger UI
GET /docs/openapi.json  → Raw OpenAPI spec
```

The spec includes:
- All CRUD endpoints with query parameters
- Request/response schemas (from Zod)
- Auth requirements
- Pagination metadata

Customize the spec:

```ts
// ship.config.ts
api: {
  openapi: {
    title:       'My App API',
    version:     '1.0.0',
    description: 'API for My App',
    servers: [
      { url: 'https://api.myapp.com', description: 'Production' },
      { url: 'http://localhost:3001',  description: 'Development' },
    ],
    contact: {
      name:  'API Support',
      email: 'api@myapp.com',
    }
  }
}
```

---

## WebSockets & Real-time

For real-time updates (e.g., live admin notifications):

```ts
// handlers/realtime.ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/deno'  // or hono/bun
import { broadcastToAdmins } from '@ship/realtime'

const app = new Hono()

app.get('/ws', upgradeWebSocket((c) => ({
  onOpen(evt, ws) {
    const user = c.get('user')
    broadcastToAdmins.addClient(user.id, ws)
  },
  onClose(evt, ws) {
    broadcastToAdmins.removeClient(ws)
  },
})))

export default app
```

Ship's model hooks can broadcast events to connected clients:

```ts
hooks: {
  afterCreate: async (record) => {
    await broadcastToAdmins.emit('post:created', record)
  }
}
```
