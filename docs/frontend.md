# Frontend (Next.js)

Ship's frontend lives in `apps/web/` and is built on Next.js 15 with the App Router. It includes an auto-generated admin panel, a shared UI component library, and a typed SDK for data fetching.

---

## Admin Panel

Every model you define gets a fully functional admin panel at `/admin/<model>`:

| Path | Description |
|------|-------------|
| `/admin` | Dashboard with model stats |
| `/admin/posts` | List view — search, filter, sort, paginate |
| `/admin/posts/new` | Create form |
| `/admin/posts/:id` | Edit form |
| `/admin/posts/:id/history` | Audit log (if `auditLog: true`) |

### Customizing the Admin UI

The admin UI is generated in `apps/web/src/app/admin/`. Because Ship generates real files, you can edit them directly.

**Override a generated page:**

```tsx
// apps/web/src/app/admin/posts/page.tsx
// This file is NOT regenerated — you own it

import { PostListTable } from './_generated/list-table'  // import the generated parts you want
import { MyCustomFilter } from '@/components/my-filter'

export default function PostsAdminPage() {
  return (
    <div>
      <MyCustomFilter />
      <PostListTable />
    </div>
  )
}
```

### Admin Layout

The admin layout is customizable in `apps/web/src/app/admin/layout.tsx`:

```tsx
import { ShipAdminShell } from '@ship/ui'

export default function AdminLayout({ children }) {
  return (
    <ShipAdminShell
      logo={<YourLogo />}
      theme="dark"
      accentColor="#6366f1"
    >
      {children}
    </ShipAdminShell>
  )
}
```

---

## Ship SDK

The SDK (`packages/sdk`) is auto-generated and fully typed. Use it anywhere in your Next.js app.

### Server Components (RSC)

```tsx
// app/blog/page.tsx
import { ship } from '@/sdk'

export default async function BlogPage() {
  // Cached automatically (ISR with revalidateTag)
  const { data: posts, meta } = await ship.post.findMany({
    where:   { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    include: ['author', 'tags', 'cover'],
  })

  return (
    <main>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </main>
  )
}
```

### Client Components (mutations)

```tsx
// components/create-post-form.tsx
'use client'
import { ship } from '@/sdk'
import { useRouter } from 'next/navigation'

export function CreatePostForm() {
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    const post = await ship.post.create({
      title:  formData.get('title') as string,
      body:   formData.get('body') as string,
      status: 'draft',
    })
    router.push(`/admin/posts/${post.data.id}`)
  }

  return <form action={handleSubmit}>...</form>
}
```

### SDK Methods

Every model exposes these methods:

```ts
// Read
ship.post.findMany(query)           // paginated list
ship.post.findFirst(query)          // first match
ship.post.findById(id)              // by primary key
ship.post.findBySlug(slug)          // by slug field
ship.post.count(where)              // count matching records
ship.post.exists(where)             // boolean check

// Write
ship.post.create(data)
ship.post.update(id, data)
ship.post.delete(id)
ship.post.upsert(where, data)       // create or update

// Bulk
ship.post.createMany(dataArray)
ship.post.updateMany(where, data)
ship.post.deleteMany(where)
```

---

## Data Hooks (Client-Side)

For client components that need reactive data:

```tsx
'use client'
import { useShip } from '@ship/react'

export function PostList() {
  const { data, isLoading, error, refetch } = useShip.post.findMany({
    where: { status: 'published' },
    take: 10,
  })

  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  return data.map(post => <PostCard key={post.id} post={post} />)
}
```

### Mutation Hooks

```tsx
'use client'
import { useShipMutation } from '@ship/react'

export function DeletePostButton({ id }) {
  const { mutate, isPending } = useShipMutation(
    () => ship.post.delete(id),
    {
      onSuccess: () => toast.success('Post deleted'),
      onError:   (e) => toast.error(e.message),
      // Automatically invalidates 'posts' cache tag
      invalidates: ['posts'],
    }
  )

  return (
    <button onClick={() => mutate()} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  )
}
```

---

## Ship UI Components

`packages/ui` is Ship's component library — built on top of Radix UI primitives with Tailwind CSS. These are the same components used in the auto-generated admin panel.

### Form Components

```tsx
import {
  ShipForm,
  TextField,
  TextareaField,
  RichTextField,
  SelectField,
  RelationField,
  ImageField,
  DateTimeField,
  BooleanField,
  SlugField,
} from '@ship/ui'

// All field components auto-wire to react-hook-form
export function PostForm({ defaultValues, onSubmit }) {
  return (
    <ShipForm defaultValues={defaultValues} onSubmit={onSubmit}>
      <TextField     name="title"    label="Title"    required />
      <SlugField     name="slug"     from="title" />
      <SelectField   name="status"   label="Status"   options={['draft', 'published']} />
      <RelationField name="authorId" label="Author"   model="User" />
      <RelationField name="tags"     label="Tags"     model="Tag" multiple />
      <ImageField    name="cover"    label="Cover Image" />
      <RichTextField name="body"     label="Body" />
      <DateTimeField name="publishedAt" label="Publish Date" nullable />
    </ShipForm>
  )
}
```

### Table / List Components

```tsx
import { ShipTable, Column } from '@ship/ui'

<ShipTable
  data={posts}
  meta={meta}
  onSort={(field, order) => ...}
  onPage={(page) => ...}
  onSelect={(ids) => setBulkSelected(ids)}
>
  <Column field="title"       label="Title" sortable searchable />
  <Column field="status"      label="Status" render={(v) => <Badge>{v}</Badge>} />
  <Column field="author.name" label="Author" />
  <Column field="publishedAt" label="Published" sortable format="date" />
  <Column field="actions"     render={(_, row) => <RowActions post={row} />} />
</ShipTable>
```

### Filter Bar

```tsx
import { ShipFilterBar, TextFilter, SelectFilter, DateRangeFilter } from '@ship/ui'

<ShipFilterBar onFilter={(filters) => setQuery(filters)}>
  <TextFilter   field="title"  label="Search title" />
  <SelectFilter field="status" label="Status" options={['draft', 'published']} />
  <DateRangeFilter field="publishedAt" label="Published between" />
</ShipFilterBar>
```

---

## Next.js Specific Features

### Optimistic Updates

```tsx
'use client'
import { useOptimistic } from 'react'
import { ship } from '@/sdk'

export function PostStatusToggle({ post }) {
  const [optimisticPost, setOptimisticPost] = useOptimistic(post)

  async function toggle() {
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    setOptimisticPost({ ...post, status: newStatus })  // immediate UI update
    await ship.post.update(post.id, { status: newStatus })  // actual mutation
  }

  return (
    <button onClick={toggle}>
      Status: {optimisticPost.status}
    </button>
  )
}
```

### Route Handlers (API Proxying)

If you want to proxy requests through Next.js instead of calling the Hono API directly:

```ts
// apps/web/src/app/api/[...ship]/route.ts
import { createShipProxy } from '@ship/next'

export const { GET, POST, PATCH, DELETE } = createShipProxy({
  target: process.env.SHIP_API_URL!,
  // Optional: transform requests/responses
})
```

### Middleware (Auth Guard)

```ts
// apps/web/src/middleware.ts
import { shipAuth } from '@ship/next'

export const middleware = shipAuth({
  // Protect all /admin routes
  protect: ['/admin/:path*'],
  loginPage: '/login',
  unauthorizedPage: '/403',
})

export const config = {
  matcher: ['/admin/:path*'],
}
```

---

## Theming the Admin

```ts
// apps/web/src/app/admin/ship-theme.ts
import { defineTheme } from '@ship/ui'

export const theme = defineTheme({
  colors: {
    primary:    '#6366f1',
    background: '#0f0f11',
    surface:    '#1a1a1f',
    border:     '#2a2a35',
    text:       '#f1f1f5',
    muted:      '#6b6b7b',
  },
  fonts: {
    sans: 'Inter, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  radius: '0.5rem',
  sidebar: {
    width: '240px',
    collapsed: '64px',
  }
})
```
