# Getting Started with Ship

This guide walks you through installing Ship, creating your first project, defining a model, and having a fully working CRUD API + admin UI running in under 5 minutes.

---

## Prerequisites

| Tool    | Minimum Version                 |
| ------- | ------------------------------- |
| Node.js | 20+                             |
| pnpm    | 9+                              |
| MongoDB | 7+ (or Docker)                  |
| Redis   | 7+ (or Docker, optional in dev) |

---

## 1. Install the CLI

```bash
npm install -g @ship/cli
# or
pnpm add -g @ship/cli
```

Verify installation:

```bash
ship --version
# ship/0.1.0
```

---

## 2. Create a New Project

```bash
ship create my-app
cd my-app
```

The CLI will prompt you for:

```
? Database adapter         › MongoDB
? Cache adapter            › Redis
? Auth strategy            › JWT
? File storage             › Local (can change later)
? Install dependencies?    › Yes
```

Project structure created:

```
my-app/
├── apps/
│   ├── web/              # Next.js frontend (App Router)
│   └── api/              # Hono.js backend
├── packages/
│   ├── db/               # Mongoose models + connection
│   ├── cache/            # Cache adapters
│   └── sdk/              # Auto-generated typed client
├── ship.config.ts         # Model definitions & global config
├── ship.env.ts            # Environment variable schema
├── docker-compose.yml     # MongoDB + Redis for local dev
├── package.json           # Monorepo root (pnpm workspaces)
└── turbo.json             # Turborepo for parallel builds
```

---

## 3. Set Up Environment

```bash
cp .env.example .env
```

Minimum required variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/myapp

# Cache
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars

# App
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Start the local dev services (MongoDB + Redis via Docker):

```bash
docker-compose up -d
```

---

## 4. Define Your First Model

Open `ship.config.ts` and add a model:

```ts
import { defineConfig, defineModel, field } from '@ship/core'

export const Post = defineModel('Post', {
  // Basic text fields
  title:     field.text({ required: true, searchable: true, maxLength: 200 }),
  slug:      field.slug({ from: 'title', unique: true }),
  excerpt:   field.text({ maxLength: 500, nullable: true }),
  body:      field.richText(),

  // Media
  cover:     field.image({ storage: 'local', nullable: true }),

  // Categorization
  status:    field.select(['draft', 'published', 'archived'], { default: 'draft' }),
  tags:      field.relation('Tag', { many: true }),
  author:    field.relation('User', { many: false }),

  // Timestamps (auto-managed)
  publishedAt: field.datetime({ nullable: true }),
}, {
  // Cache configuration for this model
  cache: {
    ttl: 300,                      // 5 minutes
    strategy: 'stale-while-revalidate',
    tags: ['posts'],               // for grouped invalidation
  },

  // Permission rules
  permissions: {
    list:   'public',
    read:   'public',
    create: 'role:editor',
    update: 'role:editor',
    delete: 'role:admin',
  },

  // Admin UI hints
  admin: {
    listFields:  ['title', 'status', 'author', 'publishedAt'],
    searchField: 'title',
    defaultSort: { field: 'publishedAt', order: 'desc' },
  }
})

export default defineConfig({
  models: [Post],
  database: { adapter: 'mongodb' },
  cache:    { adapter: 'redis' },
  auth:     { adapter: 'jwt' },
})
```

---

## 5. Generate & Sync

```bash
# Generate Mongoose models, API routes, admin UI, and SDK from your definitions
ship generate

# Push indexes & validators to MongoDB (no migrations needed)
ship db:sync
```

> MongoDB is schema-flexible — Ship manages **indexes** and **validation rules** instead of traditional SQL migrations.

What `ship generate` creates:

```
apps/api/src/routes/
├── posts/
│   ├── list.ts       # GET /api/posts
│   ├── get.ts        # GET /api/posts/:id
│   ├── create.ts     # POST /api/posts
│   ├── update.ts     # PATCH /api/posts/:id
│   └── delete.ts     # DELETE /api/posts/:id

apps/web/src/app/admin/
└── posts/
    ├── page.tsx          # List view
    ├── new/page.tsx      # Create form
    └── [id]/
        ├── page.tsx      # Edit form
        └── delete/       # Delete confirmation

packages/db/src/models/
└── Post.ts               # Mongoose Schema + Model

packages/sdk/src/
└── posts.ts              # ship.post.findMany(), etc.
```

---

## 6. Start Dev Servers

```bash
# Start everything (API + Web) in parallel
ship dev

# Or individually:
ship dev --app api   # http://localhost:3001
ship dev --app web   # http://localhost:3000
```

---

## 7. Explore

| URL                                               | Description                             |
| ------------------------------------------------- | --------------------------------------- |
| `http://localhost:3000/admin`                   | Admin panel — list, create, edit Posts |
| `http://localhost:3001/api/posts`               | REST API — paginated list              |
| `http://localhost:3001/api/posts/my-first-slug` | Single post                             |
| `http://localhost:3001/docs`                    | Auto-generated OpenAPI / Swagger UI     |

---

## 8. Using the SDK on the Frontend

In any Next.js Server Component or Client Component:

```ts
import { ship } from '@/sdk'

// Server Component — cached automatically
export default async function PostsPage() {
  const posts = await ship.post.findMany({
    where:   { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    include: ['author', 'tags'],
  })

  return <PostList posts={posts} />
}
```

```ts
// Client Component — mutation
'use client'
import { ship } from '@/sdk'

async function createPost(data: CreatePostInput) {
  const post = await ship.post.create(data)
  return post
}
```

---

## Next Steps

- [Understand the architecture →](./architecture.md)
- [Learn about all field types →](./models.md)
- [Master the caching system →](./caching.md)
- [Customize the admin UI →](./frontend.md)
- [Add authentication →](./auth.md)
