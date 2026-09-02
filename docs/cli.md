# CLI Reference

The `ship` CLI is your main interface for creating projects, generating code, managing the database, and running dev servers.

---

## Installation

```bash
npm install -g @ship/cli
# or
pnpm add -g @ship/cli
```

---

## Commands

### `ship create <name>`

Scaffold a new Ship project.

```bash
ship create my-app
ship create my-app --db postgres --cache redis --auth jwt
ship create my-app --no-install   # skip dependency installation
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--db` | `mongodb` | Database adapter: `mongodb` (default), `sqlite` (dev/edge) |
| `--cache` | `redis` | Cache adapter: `redis`, `memory`, `cf-kv` |
| `--auth` | `jwt` | Auth strategy: `jwt`, `session` |
| `--storage` | `local` | File storage: `local`, `s3`, `r2` |
| `--no-install` | false | Skip npm/pnpm install |
| `--pm` | `pnpm` | Package manager: `pnpm`, `npm`, `bun` |

---

### `ship generate`

Generate all code from your `ship.config.ts` model definitions.

```bash
ship generate
ship generate --watch      # re-generate on config changes
ship generate --model Post # generate only for specific model
ship generate --dry-run    # preview what would be generated
```

**What gets generated:**

- `packages/db/src/models/<Model>.ts` — Mongoose Schema + Model
- `apps/api/src/routes/<model>/` — Hono route handlers
- `apps/api/src/services/<model>.service.generated.ts` — Service layer
- `apps/web/src/app/admin/<model>/` — Admin UI pages
- `packages/sdk/src/<model>.ts` — Typed client methods

> ⚠️ Files ending in `.generated.ts` are always overwritten. Files without `.generated` suffix are never overwritten.

---

### `ship dev`

Start the development servers.

```bash
ship dev                    # start both API + Web
ship dev --app api          # only start Hono API
ship dev --app web          # only start Next.js
ship dev --port 4000        # custom port for API
```

Default ports:
- API: `http://localhost:3001`
- Web: `http://localhost:3000`

---

### `ship build`

Build for production.

```bash
ship build           # build both apps
ship build --app api
ship build --app web
```

---

### `ship db:sync`

Push your model's indexes and validators to MongoDB. Run this after adding new indexes or changing field constraints.

```bash
ship db:sync
ship db:sync --model Post     # sync only one model
ship db:sync --dry-run        # preview what will be synced
```

> MongoDB is schema-flexible — you never need SQL-style migrations. `db:sync` handles index creation/dropping and Mongoose validator updates.

---

### `ship db:indexes`

View all current indexes in your MongoDB collections.

```bash
ship db:indexes
ship db:indexes --model Post
```

---

### `ship db:studio`

Open a visual MongoDB collection browser (powered by Mongo Express).

```bash
ship db:studio
# Opens at http://localhost:8081
```

---

### `ship db:seed`

Run seed files to populate the database with initial data.

```bash
ship db:seed
ship db:seed --file seed/products.ts
```

Seed files live in `packages/db/src/seed/`:

```ts
// packages/db/src/seed/posts.ts
import { PostModel } from '../models'

export async function seedPosts() {
  await PostModel.insertMany([
    { title: 'Hello World',     slug: 'hello-world',     status: 'published' },
    { title: 'Getting Started', slug: 'getting-started', status: 'published' },
  ])
}
```

---

### `ship db:reset`

Drop and recreate all MongoDB collections, then re-sync indexes and run seeds.

```bash
ship db:reset
# ⚠️ Destructive — confirms before running
```

---

### `ship cache:flush`

Clear all cached data.

```bash
ship cache:flush                     # flush everything
ship cache:flush --tag posts         # flush by cache tag
ship cache:flush --key posts:list:*  # flush by key pattern
```

---

### `ship cache:stats`

View cache hit/miss statistics.

```bash
ship cache:stats
```

---

### `ship add <plugin>`

Add a Ship plugin to your project.

```bash
ship add search         # adds Meilisearch integration
ship add uploads-r2     # adds Cloudflare R2 storage adapter
ship add email-resend   # adds Resend email adapter
ship add stripe         # adds Stripe billing plugin
```

---

### `ship info`

Print current project configuration.

```bash
ship info
```

Output:

```
Ship Framework v0.1.0
Project:    my-app
Database:   MongoDB (connected ✓)
Cache:      Redis (connected ✓)
Models:     Post, User, Tag, Category (4 total)
API URL:    http://localhost:3001
Admin URL:  http://localhost:3000/admin
```

---

### `ship types`

Re-generate TypeScript types from Mongoose model schemas (useful after manual schema changes).

```bash
ship types
```

---

## Config File

The CLI reads `ship.config.ts` in the project root for all settings. Alternatively, pass a custom config path:

```bash
ship generate --config ./config/ship.staging.ts
```

---

## Environment-Specific Commands

Use the `--env` flag to load a specific `.env` file:

```bash
ship db:sync --env .env.production
ship db:seed --env .env.staging
```
