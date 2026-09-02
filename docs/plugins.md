# Extending Ship (Plugins)

Ship is designed to be extensible. Plugins can add new field types, API middleware, admin UI panels, CLI commands, and service adapters.

---

## Plugin Structure

A Ship plugin is a package that exports a `definePlugin()` call:

```ts
// my-plugin/src/index.ts
import { definePlugin } from '@ship/core'

export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  // Extend the Ship config type (for TypeScript autocomplete)
  configSchema: z.object({
    apiKey: z.string(),
    options: z.object({ ... }).optional(),
  }),

  // Called when the plugin is registered
  setup(config, shipConfig) {
    // Register hooks, middleware, services, etc.
  },

  // Add new field types
  fields: {
    color: defineField('color', { ... }),
    video: defineField('video', { ... }),
  },

  // Add API routes to Hono
  routes(app) {
    app.get('/api/my-plugin/status', (c) => c.json({ ok: true }))
  },

  // Add pages to the Next.js admin
  adminPages: [
    { path: '/admin/my-plugin', component: './src/admin/page.tsx' },
  ],

  // Add CLI commands
  commands: [
    { name: 'my-plugin:sync', run: async (args) => { ... } },
  ],
})
```

---

## Using a Plugin

```ts
// ship.config.ts
import { stripePlugin } from '@ship/plugin-stripe'

export default defineConfig({
  models: [...],
  plugins: [
    stripePlugin({
      secretKey:      process.env.STRIPE_SECRET_KEY,
      webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET,
    }),
  ],
})
```

---

## Official Plugins

| Plugin | Install | Description |
|--------|---------|-------------|
| `@ship/plugin-stripe` | `ship add stripe` | Billing, subscriptions, webhooks |
| `@ship/plugin-meilisearch` | `ship add search` | Full-text search with Meilisearch |
| `@ship/plugin-r2` | `ship add uploads-r2` | Cloudflare R2 file storage |
| `@ship/plugin-s3` | `ship add uploads-s3` | AWS S3 file storage |
| `@ship/plugin-resend` | `ship add email-resend` | Email via Resend |
| `@ship/plugin-sendgrid` | `ship add email-sendgrid` | Email via SendGrid |
| `@ship/plugin-sentry` | `ship add sentry` | Error tracking |
| `@ship/plugin-posthog` | `ship add posthog` | Analytics |
| `@ship/plugin-i18n` | `ship add i18n` | Internationalization for content |
| `@ship/plugin-versioning` | `ship add versioning` | Content revision history |

---

## Writing a Custom Adapter

### Cache Adapter

```ts
import type { CacheAdapter } from '@ship/cache'

export function myRedisClusterAdapter(config): CacheAdapter {
  const client = createRedisCluster(config)

  return {
    async get(key) {
      const val = await client.get(key)
      return val ? JSON.parse(val) : null
    },

    async set(key, value, ttl) {
      await client.set(key, JSON.stringify(value), { EX: ttl })
    },

    async del(key) {
      await client.del(key)
    },

    async invalidateTag(tag) {
      const keys = await client.sMembers(`tag:${tag}`)
      if (keys.length) await client.del(...keys)
      await client.del(`tag:${tag}`)
    },

    async flush() {
      await client.flushDb()
    },
  }
}
```

### Storage Adapter

```ts
import type { StorageAdapter } from '@ship/storage'

export function myStorageAdapter(config): StorageAdapter {
  return {
    async upload(file, path) {
      // Upload and return public URL
      return { url: `https://cdn.example.com/${path}` }
    },

    async delete(path) {
      // Delete the file
    },

    async getSignedUrl(path, expiresIn) {
      // Return a time-limited URL
      return `https://cdn.example.com/${path}?token=...`
    },
  }
}
```

### Database Adapter

```ts
import type { DatabaseAdapter } from '@ship/db'

export function myDbAdapter(config): DatabaseAdapter {
  return {
    // Expose a Drizzle-compatible query builder
    query: ...,
    // Raw query execution
    execute: async (sql, params) => { ... },
    // Transaction support
    transaction: async (fn) => { ... },
  }
}
```

---

## Plugin Hooks

Plugins can tap into Ship's global event system:

```ts
definePlugin({
  setup(config, ship) {
    // Listen to model lifecycle events
    ship.on('post:created', async (record, ctx) => {
      await indexInSearch(record)
    })

    ship.on('*.deleted', async (modelName, id, ctx) => {
      await syncDeletion(modelName, id)
    })

    // Add global middleware to the Hono app
    ship.api.use('*', async (c, next) => {
      c.set('requestId', crypto.randomUUID())
      await next()
    })

    // Add a new admin dashboard widget
    ship.admin.addWidget({
      title: 'My Plugin Stats',
      component: './src/admin/widget.tsx',
      position: 'dashboard',
    })
  }
})
```

---

## Publishing a Plugin

```bash
# Package structure
my-ship-plugin/
├── src/
│   ├── index.ts          # Plugin definition
│   └── admin/
│       └── page.tsx      # Optional admin UI
├── package.json
└── README.md

# package.json
{
  "name": "ship-plugin-my-plugin",
  "keywords": ["ship", "ship-plugin"],
  "peerDependencies": {
    "@ship/core": "^0.1.0"
  }
}
```

Publish to npm:

```bash
pnpm publish
```

Users can then install with:

```bash
ship add my-plugin
# Which runs: pnpm add ship-plugin-my-plugin
# And auto-registers it in ship.config.ts
```
