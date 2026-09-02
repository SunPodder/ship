# Configuration Reference

All Ship configuration lives in `ship.config.ts` at the project root. This file is the single source of truth for models, adapters, and global settings.

---

## Full Configuration Example

```ts
import { defineConfig, defineModel, field } from '@ship/core'
import { Post } from './models/post'
import { User } from './models/user'
import { Tag } from './models/tag'

export default defineConfig({

  // ─── Models ─────────────────────────────────────────────────────────────────
  models: [Post, User, Tag],


  // ─── Database ────────────────────────────────────────────────────────────────
  database: {
    adapter:  'mongodb',
    uri:      process.env.MONGODB_URI,

    // Mongoose connection options
    options: {
      maxPoolSize:       10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:   45_000,
    },

    // Optional: read from secondaries in a replica set
    readPreference: 'secondaryPreferred',

    // Index & validator sync settings
    sync: {
      autoSync:   false,   // true = run ship db:sync on startup
      background: true,    // build indexes in background
    },
  },


  // ─── Cache ───────────────────────────────────────────────────────────────────
  cache: {
    adapter:  'redis',                   // 'redis' | 'memory' | 'cloudflare-kv'
    url:      process.env.REDIS_URL,

    // Global defaults (overridden per-model)
    defaultTTL:      300,               // 5 minutes
    defaultStrategy: 'cache-first',

    // Redis-specific
    prefix:          'ship:',
    cluster:         false,

    // L1 memory cache (in-process, always enabled)
    l1: {
      maxSize: 1000,                    // max entries
      ttl:     10,                      // seconds
    },

    // Warm specific queries on startup
    warm: {
      enabled: false,
      queries: [],
    },
  },


  // ─── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    adapter: 'jwt',

    jwt: {
      secret:          process.env.JWT_SECRET,
      accessTokenTTL:  '15m',
      refreshTokenTTL: '30d',
    },

    roles:       ['superadmin', 'admin', 'editor', 'viewer'],
    defaultRole: 'viewer',

    // Enable self-registration
    registration: {
      enabled:           true,
      emailVerification: true,
    },

    // OAuth providers
    oauth: {
      google: {
        clientId:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Password rules
    password: {
      minLength: 8,
      requireUppercase: true,
      requireNumber:    true,
    },

    twoFactor: {
      enabled:  false,
      required: false,
    },
  },


  // ─── File Storage ────────────────────────────────────────────────────────────
  storage: {
    default: 'local',

    adapters: {
      local: {
        uploadDir: './uploads',
        publicUrl: process.env.NEXT_PUBLIC_API_URL + '/uploads',
      },
      r2: {
        accountId:       process.env.CF_ACCOUNT_ID,
        accessKeyId:     process.env.CF_ACCESS_KEY_ID,
        secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
        bucket:          process.env.CF_R2_BUCKET,
        publicUrl:       process.env.R2_PUBLIC_URL,
      },
      s3: {
        region:          process.env.AWS_REGION,
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        bucket:          process.env.AWS_S3_BUCKET,
      },
    },

    // Image processing (sharp)
    images: {
      optimize: true,
      quality:  80,
      formats:  ['webp', 'original'],
    },
  },


  // ─── Email ───────────────────────────────────────────────────────────────────
  email: {
    adapter: 'resend',              // 'resend' | 'sendgrid' | 'smtp' | 'log'
    apiKey:  process.env.RESEND_API_KEY,
    from:    'Ship <no-reply@myapp.com>',
  },


  // ─── Search ──────────────────────────────────────────────────────────────────
  search: {
    adapter: 'database',            // 'database' | 'meilisearch'
    // For meilisearch:
    // url:    process.env.MEILISEARCH_URL,
    // apiKey: process.env.MEILISEARCH_API_KEY,
  },


  // ─── API ─────────────────────────────────────────────────────────────────────
  api: {
    prefix:  '/api',
    port:    3001,

    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
      credentials: true,
    },

    rateLimit: {
      windowMs: 60_000,
      max:      100,
    },

    pagination: {
      defaultLimit: 20,
      maxLimit:     100,
      style:        'offset',  // 'offset' | 'cursor'
    },

    openapi: {
      enabled:     true,
      path:        '/docs',
      title:       'My App API',
      version:     '1.0.0',
    },
  },


  // ─── Admin UI ────────────────────────────────────────────────────────────────
  admin: {
    path:  '/admin',
    title: 'My App Admin',

    theme: {
      primaryColor: '#6366f1',
      darkMode:     true,
    },

    // Groups for sidebar navigation
    groups: [
      { name: 'Content',  models: ['Post', 'Tag', 'Category'] },
      { name: 'Commerce', models: ['Product', 'Order'] },
      { name: 'Users',    models: ['User'] },
    ],

    // Show cache inspector (admin-only)
    cacheInspector: true,
  },


  // ─── Hooks ────────────────────────────────────────────────────────────────────
  // Global hooks run for ALL models
  globalHooks: {
    beforeCreate: async (modelName, data, ctx) => {
      // e.g., add audit metadata
      return data
    },
    afterCreate: async (modelName, record, ctx) => {
      // e.g., global analytics tracking
    },
  },


  // ─── Plugins ─────────────────────────────────────────────────────────────────
  plugins: [
    // ship add stripe → installs and registers here automatically
  ],

})
```

---

## Environment Variables

Ship validates all environment variables at startup using Zod. Define them in `ship.env.ts`:

```ts
// ship.env.ts
import { defineEnv } from '@ship/core'
import { z } from 'zod'

export const env = defineEnv({
  // Database
  MONGODB_URI: z.string().url(),

  // Cache
  REDIS_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),

  // Frontend
  NEXT_PUBLIC_API_URL: z.string().url(),

  // Optional
  RESEND_API_KEY: z.string().optional(),
  CF_ACCOUNT_ID:  z.string().optional(),
})
```

If a required variable is missing or invalid, Ship throws a descriptive error at startup:

```
❌ Invalid environment variables:
  MONGODB_URI: Required
  JWT_SECRET: String must contain at least 32 character(s)
```

---

## Multiple Environments

Use `.env.local` for local overrides (gitignored):

```
.env              # committed defaults
.env.local        # local overrides (gitignored)
.env.production   # production values (managed via CI/CD secrets)
.env.test         # test database/cache settings
```
