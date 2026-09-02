# Models & Schema

Models are the core of Ship. Every model definition in `ship.config.ts` becomes your database table, API endpoints, validation rules, admin UI, and typed SDK — all at once.

---

## Defining a Model

```ts
import { defineModel, field } from '@ship/core'

export const Article = defineModel('Article', {
  // field definitions
}, {
  // model options
})
```

The first argument is the model name (PascalCase). Ship uses this to derive:
- Collection name: `articles` (camelCase, plural) in MongoDB
- API routes: `/api/articles`
- SDK methods: `ship.article.*`
- Admin UI path: `/admin/articles`

---

## Built-in Field Types

### Text Fields

```ts
// Single-line text
title: field.text({
  required: true,
  minLength: 3,
  maxLength: 200,
  searchable: true,       // included in full-text search
  unique: false,
})

// Multi-line textarea
bio: field.textarea({
  maxLength: 2000,
  nullable: true,
})

// Rich text (Tiptap editor in admin UI)
body: field.richText({
  nullable: true,
  // stored as JSON (Tiptap format) or HTML
  output: 'html',         // 'json' | 'html' | 'markdown'
})

// URL with validation
website: field.url({ nullable: true })

// Email with validation
email: field.email({ required: true, unique: true })

// Password (bcrypt hashed automatically)
password: field.password({ required: true })
```

### Slug Field

Auto-generates URL-friendly slugs. Handles uniqueness by appending `-2`, `-3`, etc.

```ts
slug: field.slug({
  from: 'title',          // derive from this field
  unique: true,           // always recommended
  // Or set manually:
  editable: true,         // allow manual override in admin UI
})
```

### Number Fields

```ts
price:     field.decimal({ precision: 10, scale: 2, min: 0 })
quantity:  field.integer({ min: 0, default: 0 })
rating:    field.float({ min: 0, max: 5, nullable: true })
```

### Boolean

```ts
isActive:  field.boolean({ default: true })
isFeatured: field.boolean({ default: false })
```

### Select / Enum

```ts
status: field.select(['draft', 'published', 'archived'], {
  default: 'draft',
  // Renders as a dropdown in admin UI
})

// Typed enum (TypeScript union inferred automatically)
// type: 'draft' | 'published' | 'archived'
```

### Multi-select

```ts
visibility: field.multiSelect(['web', 'mobile', 'api'], {
  default: ['web'],
  // Stored as a native MongoDB array
})
```

### Date & Time

```ts
publishedAt:  field.datetime({ nullable: true })
birthDate:    field.date({ nullable: true })
startTime:    field.time({ nullable: true })

// Automatic timestamp fields (always added, no need to define):
// createdAt, updatedAt
```

### JSON

For unstructured or flexible data:

```ts
metadata: field.json({
  nullable: true,
  // Optional: provide a Zod schema for validation
  schema: z.object({
    views: z.number(),
    source: z.string(),
  })
})
```

### Relation Fields

```ts
// Many-to-one: stores ObjectId reference in this document
author: field.relation('User', {
  many: false,
  required: true,
  // MongoDB: stores authorId as ObjectId, populated via .populate('author')
})

// Many-to-many: stores array of ObjectId references
tags: field.relation('Tag', {
  many: true,
  // MongoDB: stores tagIds: [ObjectId, ...] on this document
})

// One-to-many (virtual reverse — no field stored here)
comments: field.relation('Comment', {
  many: true,
  reverse: true,  // FK lives on Comment.postId as ObjectId
})
```

> **Embedded vs Reference**: For tightly coupled sub-data, use `field.embedded()` instead of a relation — it stores the data directly inside the document rather than as a separate collection reference.

### Embedded Document Field

Store a sub-document directly inside the parent document (no separate collection). Best for data that is always fetched with the parent and has no independent identity.

```ts
// Stored as a nested object inside the Post document
seo: field.embedded({
  schema: {
    metaTitle:       field.text({ maxLength: 60, nullable: true }),
    metaDescription: field.text({ maxLength: 160, nullable: true }),
    ogImage:         field.image({ storage: 'r2', nullable: true }),
    canonicalUrl:    field.url({ nullable: true }),
  },
  nullable: true,
})

// Array of embedded documents
variants: field.embedded({
  many: true,
  schema: {
    size:   field.text({ required: true }),
    color:  field.text({ required: true }),
    price:  field.decimal({ required: true }),
    stock:  field.integer({ default: 0 }),
  }
})
```

In the API response:
```json
{
  "id": "64f2...",
  "title": "My Post",
  "seo": {
    "metaTitle": "My Post - Site",
    "metaDescription": "A great post about...",
    "canonicalUrl": null
  }
}
```

### Image Field

```ts
avatar: field.image({
  storage: 'local',       // 'local' | 's3' | 'r2'
  nullable: true,
  maxSize: '5mb',
  // Auto-generates thumbnails on upload
  sizes: {
    thumb:  { width: 100, height: 100, fit: 'cover' },
    medium: { width: 800 },
  }
})
```

### File Field

```ts
attachment: field.file({
  storage: 'r2',
  accept: ['.pdf', '.docx'],
  maxSize: '10mb',
  nullable: true,
})
```

---

## Auto-Managed Fields

These fields are automatically added to every model. You don't define them:

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `ObjectId` | MongoDB primary key (auto-generated) |
| `id` | `string` | Virtual field — hex string of `_id`, used in API responses |
| `createdAt` | `Date` | Set on creation via Mongoose timestamps |
| `updatedAt` | `Date` | Updated automatically on every save |

Mongoose `timestamps: true` is always enabled. The `_id` is a MongoDB `ObjectId`; Ship serializes it as a hex string (`id`) in all API responses so you never deal with raw ObjectIds on the frontend.

You can configure the ID type globally or per-model:

```ts
defineModel('Post', { ... }, {
  id: 'objectid',    // default — MongoDB native ObjectId
  // id: 'uuid'      // store UUIDs as strings instead
  // id: 'cuid2'     // store cuid2 strings
  // id: 'nanoid'    // store nanoid strings
})
```

---

## Model Options

```ts
defineModel('Post', fields, {
  // ─── Cache ─────────────────────────────────────────────
  cache: {
    ttl: 300,                           // seconds; false to disable
    strategy: 'cache-first',            // see caching.md
    tags: ['posts', 'content'],         // for grouped invalidation
    // Per-operation overrides:
    list:   { ttl: 60 },
    single: { ttl: 600 },
    // Disable cache for specific operations:
    write:  false,
  },

  // ─── Permissions ────────────────────────────────────────
  permissions: {
    list:   'public',                   // no auth required
    read:   'public',
    create: 'authenticated',            // any logged-in user
    update: 'role:editor',             // specific role
    delete: 'role:admin',
    // Field-level permissions:
    fields: {
      password: { read: 'self', write: 'self' },
      role:     { read: 'role:admin', write: 'role:admin' },
    }
  },

  // ─── Hooks ──────────────────────────────────────────────
  hooks: {
    beforeCreate: async (data, ctx) => {
      // Mutate data before insert
      data.slug = slugify(data.title)
      return data
    },
    afterCreate: async (record, ctx) => {
      // Side effects after insert (emails, webhooks, etc.)
      await sendNotification(record)
    },
    beforeUpdate: async (id, data, ctx) => data,
    afterUpdate:  async (record, ctx) => {},
    beforeDelete: async (id, ctx) => {},
    afterDelete:  async (id, ctx) => {},
  },

  // ─── Admin UI ───────────────────────────────────────────
  admin: {
    label:       'Blog Post',           // human-readable name
    pluralLabel: 'Blog Posts',
    description: 'Articles for the blog',
    group:       'Content',            // sidebar grouping
    icon:        'file-text',          // Lucide icon name
    listFields:  ['title', 'status', 'author', 'publishedAt'],
    searchField: 'title',
    defaultSort: { field: 'createdAt', order: 'desc' },
    // Hide from admin UI entirely:
    hidden: false,
  },

  // ─── Database ────────────────────────────────────────────
  // MongoDB collection name (default: lowercase plural of model name)
  collection: 'blog_posts',
  indexes: [
    { fields: ['status', 'publishedAt'] },
    { fields: ['slug'], unique: true },
    // MongoDB text index for full-text search
    { fields: ['title', 'excerpt'], type: 'text' },
  ],
  softDelete: true,                    // adds deletedAt field
})
```

---

## Computed Fields

Computed fields are derived at query time and are not stored in the DB:

```ts
export const User = defineModel('User', {
  firstName: field.text({ required: true }),
  lastName:  field.text({ required: true }),
}, {
  computed: {
    fullName: {
      type: 'text',
      resolve: (row) => `${row.firstName} ${row.lastName}`,
    }
  }
})
```

Computed fields appear in API responses and the admin UI, but can't be queried/filtered directly.

---

## Virtual Relations

Sometimes you want to expose related data without a real FK:

```ts
export const Post = defineModel('Post', { ... }, {
  virtual: {
    relatedPosts: {
      model: 'Post',
      resolve: async (post, { model }) =>
        model.find({ status: 'published' })
          .limit(3)
          .lean(),
    }
  }
})
```

---

## Full Example: E-Commerce Product

```ts
export const Product = defineModel('Product', {
  name:        field.text({ required: true, searchable: true }),
  slug:        field.slug({ from: 'name', unique: true }),
  description: field.richText({ nullable: true }),
  price:       field.decimal({ precision: 10, scale: 2, required: true }),
  salePrice:   field.decimal({ precision: 10, scale: 2, nullable: true }),
  sku:         field.text({ unique: true, required: true }),
  stock:       field.integer({ min: 0, default: 0 }),
  images:      field.image({ storage: 'r2', many: true }),
  category:    field.relation('Category', { many: false }),
  tags:        field.relation('Tag', { many: true }),
  status:      field.select(['active', 'inactive', 'discontinued'], { default: 'active' }),
  metadata:    field.json({ nullable: true }),
}, {
  cache: { ttl: 600, tags: ['products'] },
  permissions: {
    list:   'public',
    read:   'public',
    create: 'role:admin',
    update: 'role:admin',
    delete: 'role:admin',
  },
  indexes: [
    { fields: ['sku'], unique: true },
    { fields: ['status', 'price'] },
    { fields: ['categoryId'] },
    // Text index for full-text search on name + description
    { fields: ['name', 'description'], type: 'text' },
  ],
  admin: {
    group: 'Catalog',
    listFields: ['name', 'sku', 'price', 'stock', 'status'],
    defaultSort: { field: 'createdAt', order: 'desc' },
  },
  softDelete: true,
})
```
