<p align="center">
  <img src="docs/assets/ship-logo.webp" alt="Ship — Ship fast. Cache smart. Scale painlessly." width="520" />
</p>

# Ship

**Schema-first full-stack CMS.** Define your models once — get a typed REST API, a daisyUI admin panel, automatic caching, and file uploads with WebP optimization. Built for people who want PayloadCMS's power without the lock-in: every generated file is yours to read and edit.

## Highlights

- **Schema-first** — `defineModel()` drives REST endpoints, Mongoose models, validation, admin UI, and typed SDK.
- **Cached by default** — two-level cache (memory + Redis) with tag-based invalidation.
- **Auto-generated admin** — daisyUI, themed, with a first-run admin bootstrap.
- **Media, done** — image uploads auto-optimize to WebP with resized variants.
- **No runtime magic** — `ship generate` writes real files you own.

## Quick start

```bash
# 1. Install the CLI (local, pre-publish)
cd packages/cli && bun link

# 2. Create a project
ship create my-app
cd my-app

# 3. Install + run
cp .env.example .env
bun install
docker compose up -d        # MongoDB + Redis
ship generate               # emit admin pages + typed SDK
ship dev                    # API :3001, admin :3000
```

Open `http://localhost:3000/admin` — create your first admin user and go.

## Packages

| Package | Purpose |
|---|---|
| `@ship/core` | Model DSL — `defineModel`, `field.*`, config, env, validation |
| `@ship/db` | `FieldDef` → Mongoose schema + connection |
| `@ship/cache` | Memory/Redis adapters + cache strategies |
| `@ship/auth` | bcrypt + JWT + role/permission guards |
| `@ship/storage` | sharp WebP pipeline + storage adapters |
| `@ship/sdk` | Typed REST client |
| `@ship/ui` | daisyUI admin component library |
| `@ship/cli` | `ship create` / `dev` / `build` / `sail` / `generate` |

## Commands

| Command | What it does |
|---|---|
| `ship create <name>` | Scaffold a new project |
| `ship dev` | Start API + web dev servers |
| `ship build` | Production build |
| `ship sail` | Serve the built app |
| `ship generate` | Emit admin pages + typed SDK from `ship.config.ts` |

## Documentation

- [Architecture](docs/architecture.md)
- [Models & Schema](docs/models.md)
- [Caching](docs/caching.md)
- [Configuration](docs/config.md)
- [File Uploads](docs/uploads.md)

## Status

Pre-`1.0`. Core scaffolding, CRUD engine, caching, auth, storage, REST API, SDK, UI, and CLI are implemented. `@ship/*` are linked locally (`ship create --link` is the default) until published to npm.
