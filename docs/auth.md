# Auth & Permissions

Ship includes a complete authentication and authorization system. You don't need to install or configure a third-party auth library — it's built in.

---

## Overview

Ship uses **JWT-based auth** by default with optional session support. Permissions are defined per-model and evaluated in the middleware stack before your handlers run.

```
Request → Auth Middleware → Permission Check → Handler
```

---

## Built-in Auth Endpoints

These endpoints are automatically available:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Email + password login |
| `POST` | `/api/auth/logout` | Invalidate session/token |
| `POST` | `/api/auth/refresh` | Refresh JWT access token |
| `POST` | `/api/auth/register` | Register new user (if enabled) |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/auth/reset-password` | Set new password via token |
| `GET`  | `/api/auth/me` | Get current user profile |
| `PATCH`| `/api/auth/me` | Update current user profile |

---

## User Model

Ship auto-creates a `User` model. It includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `email` | text | Unique, validated |
| `password` | text | bcrypt hashed |
| `role` | text | User role |
| `firstName` | text | Optional |
| `lastName` | text | Optional |
| `avatar` | image | Optional |
| `emailVerifiedAt` | datetime | Null if not verified |
| `lastLoginAt` | datetime | Auto-updated on login |

Extend it in `ship.config.ts`:

```ts
import { extendModel } from '@ship/core'

extendModel('User', {
  // Add your custom fields
  bio:          field.textarea({ nullable: true }),
  subscription: field.select(['free', 'pro', 'enterprise'], { default: 'free' }),
  company:      field.text({ nullable: true }),
})
```

---

## Roles & Permissions

### Built-in Roles

| Role | Description |
|------|-------------|
| `superadmin` | Full access to everything |
| `admin` | Full access, cannot manage superadmins |
| `editor` | Can create/update content |
| `viewer` | Read-only |
| `authenticated` | Any logged-in user |
| `public` | No auth required |

### Custom Roles

```ts
// ship.config.ts
auth: {
  roles: ['superadmin', 'admin', 'editor', 'moderator', 'viewer'],
  defaultRole: 'viewer',
}
```

### Permission Levels

```ts
permissions: {
  list:   'public',           // Anyone can list
  read:   'public',           // Anyone can read
  create: 'authenticated',    // Must be logged in
  update: 'role:editor',      // Must have 'editor' role or higher
  delete: 'role:admin',       // Must have 'admin' role or higher
}
```

**Role hierarchy** (highest to lowest):
```
superadmin > admin > editor > moderator > viewer > authenticated > public
```

Checking `role:editor` passes for `editor`, `admin`, and `superadmin`.

### Field-Level Permissions

Control which users can read or write specific fields:

```ts
permissions: {
  // ... operation permissions ...
  fields: {
    // Only the user themselves (or admin) can see their email
    email:    { read: 'self', write: 'self' },
    // Only admins can set roles
    role:     { read: 'role:admin', write: 'role:admin' },
    // Password never readable via API
    password: { read: 'none', write: 'self' },
    // Salary visible only to HR and self
    salary:   { read: ['role:hr', 'self'], write: 'role:hr' },
  }
}
```

`'self'` means the authenticated user's own record (when the model has a user relation).

---

## JWT Configuration

```ts
// ship.config.ts
auth: {
  adapter: 'jwt',
  jwt: {
    secret:           process.env.JWT_SECRET,
    accessTokenTTL:   '15m',    // short-lived access token
    refreshTokenTTL:  '30d',    // long-lived refresh token
    algorithm:        'HS256',  // or 'RS256' for asymmetric
  },
  // Store refresh tokens in Redis (recommended)
  refreshTokenStore: 'redis',
}
```

### Token Rotation

Ship uses **refresh token rotation**: each time you use a refresh token, it's invalidated and a new one is issued. This limits the window for token theft.

---

## Session Auth

For server-rendered apps where cookies are preferred:

```ts
auth: {
  adapter: 'session',
  session: {
    secret:  process.env.SESSION_SECRET,
    maxAge:  30 * 24 * 60 * 60,  // 30 days
    store:   'redis',             // or 'database'
    cookie: {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
    }
  }
}
```

---

## OAuth / Social Login

```ts
auth: {
  oauth: {
    google: {
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Automatically creates a User record on first login
    },
    github: {
      clientId:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  }
}
```

Endpoints added automatically:

```
GET /api/auth/oauth/google          → redirect to Google
GET /api/auth/oauth/google/callback → handle callback
```

---

## Guards in Route Handlers

```ts
import {
  requireAuth,
  requireRole,
  requirePermission,
  requireOwner,
} from '@ship/auth'

// Must be logged in
app.get('/profile', requireAuth(), handler)

// Must have 'admin' role or higher
app.delete('/api/posts/:id', requireRole('admin'), handler)

// Uses model permission config
app.post('/api/posts', requirePermission('posts', 'create'), handler)

// Must own the resource (userId matches record's userId)
app.patch('/api/comments/:id', requireOwner('Comment'), handler)
```

---

## Accessing User in Handlers

```ts
app.get('/api/me/posts', requireAuth(), async (c) => {
  const user = c.get('user')   // type: ShipUser
  // user.id, user.email, user.role, ...

  const posts = await postService.list({
    where: { authorId: user.id }
  }, { user })

  return c.json(ok(posts))
})
```

---

## Frontend: Auth in Next.js

Ship provides Next.js middleware and hooks for auth:

### Middleware (route protection)

```ts
// apps/web/src/middleware.ts
import { shipAuth } from '@ship/next'

export const middleware = shipAuth({
  protect: ['/admin/:path*', '/dashboard/:path*'],
  loginPage: '/login',
  roleRequired: {
    '/admin/:path*': 'editor',  // admin area requires 'editor' role
  }
})
```

### Server Component

```ts
import { getServerUser } from '@ship/next/server'

export default async function DashboardPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  return <Dashboard user={user} />
}
```

### Client Hook

```tsx
'use client'
import { useUser } from '@ship/react'

export function Header() {
  const { user, isLoading, logout } = useUser()

  if (isLoading) return null

  return (
    <header>
      {user ? (
        <>
          <span>Hi, {user.firstName}</span>
          <button onClick={logout}>Log out</button>
        </>
      ) : (
        <a href="/login">Log in</a>
      )}
    </header>
  )
}
```

### Login Form

```tsx
'use client'
import { useLogin } from '@ship/react'

export function LoginForm() {
  const { login, isPending, error } = useLogin({
    redirectTo: '/admin',
  })

  return (
    <form action={login}>
      <input name="email"    type="email"    required />
      <input name="password" type="password" required />
      {error && <p>{error.message}</p>}
      <button disabled={isPending}>Log in</button>
    </form>
  )
}
```

---

## Email Verification

Enable in config:

```ts
auth: {
  emailVerification: {
    required: true,          // block login until verified
    tokenTTL: 24 * 60 * 60, // 24 hours
  }
}
```

Ship sends a verification email on registration using your configured email adapter. The verify link calls `GET /api/auth/verify-email?token=...`.

---

## Two-Factor Authentication (2FA)

```ts
auth: {
  twoFactor: {
    enabled:  true,
    required: false,   // if true, all users must enable 2FA
    methods: ['totp'], // Google Authenticator, Authy, etc.
  }
}
```

2FA endpoints are automatically added:
- `POST /api/auth/2fa/setup` — generate TOTP secret + QR code
- `POST /api/auth/2fa/verify` — verify TOTP code
- `POST /api/auth/2fa/disable` — disable 2FA
