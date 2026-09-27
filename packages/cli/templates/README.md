# {{name}}

Built with [Ship](https://ship.dev) — a schema-first full-stack CMS.

## Develop

```bash
bun install
docker compose up -d   # MongoDB + Redis
bun run dev            # or: ship dev
```

- API: http://localhost:3001/api
- Web: http://localhost:3000

## Commands

- `ship dev` — start the dev servers
- `ship build` — production build
- `ship sail` — serve the built app
