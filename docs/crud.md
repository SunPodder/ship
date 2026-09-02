# CRUD Engine

The CRUD engine is what Ship generates for each model: a complete set of API endpoints, a service layer with business logic, and a validation layer — all automatically, all type-safe.

---

## Auto-Generated API Routes

For every model, Ship generates these Hono.js routes in `apps/api/src/routes/<model>/`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/:model` | List with filtering, sorting, pagination |
| `GET` | `/api/:model/:id` | Get single record by ID or slug |
| `POST` | `/api/:model` | Create a new record |
| `PATCH` | `/api/:model/:id` | Partial update |
| `PUT` | `/api/:model/:id` | Full replacement update |
| `DELETE` | `/api/:model/:id` | Delete a record |
| `GET` | `/api/:model/bulk` | Bulk read by IDs |
| `POST` | `/api/:model/bulk` | Bulk create |
| `PATCH` | `/api/:model/bulk` | Bulk update |
| `DELETE` | `/api/:model/bulk` | Bulk delete |

---

## List / Query API

### Filtering

```
GET /api/posts?status=published
GET /api/posts?status[in]=published,draft
GET /api/posts?price[gte]=100&price[lte]=500
GET /api/posts?title[contains]=ship
GET /api/posts?title[startsWith]=Intr
GET /api/posts?author.name=John         (relation filter)
GET /api/posts?publishedAt[gte]=2024-01-01
```

**Filter operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `[eq]` | Equals (default) | `?status=published` |
| `[ne]` | Not equals | `?status[ne]=archived` |
| `[in]` | In list | `?status[in]=a,b` |
| `[nin]` | Not in list | `?status[nin]=deleted` |
| `[gt]` | Greater than | `?price[gt]=100` |
| `[gte]` | Greater than or equal | `?price[gte]=100` |
| `[lt]` | Less than | `?price[lt]=500` |
| `[lte]` | Less than or equal | `?price[lte]=500` |
| `[contains]` | Contains string | `?title[contains]=ship` |
| `[startsWith]` | Starts with | `?title[startsWith]=Intro` |
| `[endsWith]` | Ends with | `?email[endsWith]=.com` |
| `[null]` | Is null | `?publishedAt[null]=true` |
| `[notNull]` | Is not null | `?publishedAt[notNull]=true` |

### Sorting

```
GET /api/posts?sort=createdAt          (ascending)
GET /api/posts?sort=-createdAt         (descending, prefix -)
GET /api/posts?sort=status,-publishedAt (multi-sort)
```

### Pagination

```
GET /api/posts?page=2&limit=20
GET /api/posts?cursor=eyJpZCI6IjEyMyJ9   (cursor-based)
```

**Response shape:**

```json
{
  "data": [ ... ],
  "meta": {
    "total": 142,
    "page": 2,
    "limit": 20,
    "pageCount": 8,
    "nextCursor": "eyJpZCI6IjE0MyJ9"
  }
}
```

### Including Relations

```
GET /api/posts?include=author,tags
GET /api/posts?include=author.profile,tags.category
```

### Field Selection

```
GET /api/posts?fields=id,title,slug,status
GET /api/posts?fields=-body,-metadata   (exclude fields)
```

### Search

Full-text search across `searchable: true` fields:

```
GET /api/posts?q=nextjs+tutorial
```

### Combining Everything

```
GET /api/posts
  ?status=published
  &sort=-publishedAt
  &page=1
  &limit=12
  &include=author,tags
  &fields=id,title,slug,cover,publishedAt,author.name,tags.name
  &q=getting+started
```

---

## Request & Response Examples

### Create

```http
POST /api/posts
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Getting Started with Ship",
  "body": "<p>Ship is a full-stack framework...</p>",
  "status": "draft",
  "authorId": "user-uuid-here",
  "tags": ["tag-uuid-1", "tag-uuid-2"]
}
```

```json
HTTP 201 Created

{
  "data": {
    "id": "64f2a3b4c8e1d0f5a7b9c2d1",
    "title": "Getting Started with Ship",
    "slug": "getting-started-with-ship",
    "body": "<p>Ship is a full-stack framework...</p>",
    "status": "draft",
    "authorId": "64f2a3b4c8e1d0f5a7b9c2d0",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### Update (PATCH)

Only send the fields you want to change:

```http
PATCH /api/posts/post-uuid
Authorization: Bearer <token>

{ "status": "published", "publishedAt": "2025-01-15T12:00:00Z" }
```

### Validation Errors

```json
HTTP 422 Unprocessable Entity

{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "fields": {
    "title": ["Title is required"],
    "price": ["Price must be a positive number"]
  }
}
```

### Auth Errors

```json
HTTP 401 Unauthorized
{ "error": "UNAUTHORIZED", "message": "Authentication required" }

HTTP 403 Forbidden
{ "error": "FORBIDDEN", "message": "Insufficient permissions" }
```

---

## The Service Layer

Route handlers are thin. Business logic lives in the **Service layer**:

```ts
// apps/api/src/services/post.service.ts (generated)
import { PostModel } from '@ship/db/models'
import { cache } from '@ship/cache'

export class PostService {
  async list(query: PostListQuery) {
    const cacheKey = cache.key('posts', 'list', query)

    return cache.remember(cacheKey, 300, async () => {
      const filter  = buildFilter(query)
      const sort    = buildSort(query)
      const total   = await PostModel.countDocuments(filter)
      const records = await PostModel
        .find(filter)
        .sort(sort)
        .skip(query.offset)
        .limit(query.limit)
        .populate(buildPopulate(query.include))
        .lean()           // returns plain JS objects, not Mongoose docs
      return { data: records, total }
    })
  }

  async findById(id: string) {
    return cache.remember(`posts:single:${id}`, 3600, async () => {
      return PostModel.findById(id).populate('author tags').lean()
    })
  }

  async create(data: CreatePostInput) {
    const record = await PostModel.create(data)
    await cache.invalidateTag('posts')
    return record.toObject()
  }

  async update(id: string, data: UpdatePostInput) {
    const record = await PostModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).lean()
    await cache.invalidateTag('posts')
    await cache.del(`posts:single:${id}`)
    return record
  }

  async delete(id: string) {
    await PostModel.findByIdAndDelete(id)
    await cache.invalidateTag('posts')
    await cache.del(`posts:single:${id}`)
  }
}
```

**Customizing the Service:**

Create `apps/api/src/services/post.service.custom.ts` — Ship will merge your methods with the generated ones:

```ts
// Your custom overrides
export class PostServiceCustom extends PostService {
  // Override the create method
  async create(data: CreatePostInput) {
    // Custom pre-processing
    data.slug = await this.generateUniqueSlug(data.title)
    data.excerpt = this.autoExcerpt(data.body, 160)

    const record = await super.create(data)

    // Post-creation side effects
    await this.notifySubscribers(record)

    return record
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    // ... custom slug logic
  }
}
```

---

## Bulk Operations

### Bulk Create

Wrapped in a MongoDB **session + transaction** — all succeed or all fail.

```http
POST /api/posts/bulk
[
  { "title": "Post One", "status": "draft" },
  { "title": "Post Two", "status": "published" }
]
```

Wrapped in a transaction — all succeed or all fail.

### Bulk Update

```http
PATCH /api/posts/bulk
{
  "ids": ["uuid1", "uuid2", "uuid3"],
  "data": { "status": "archived" }
}
```

### Bulk Delete

```http
DELETE /api/posts/bulk
{ "ids": ["uuid1", "uuid2"] }
```

---

## Custom Endpoints

Need something beyond standard CRUD? Add custom Hono routes:

```ts
// apps/api/src/routes/posts/publish.ts
import { Hono } from 'hono'
import { requireAuth, requireRole } from '@ship/auth'
import { postService } from '../services'

const app = new Hono()

// POST /api/posts/:id/publish
app.post('/:id/publish', requireRole('editor'), async (c) => {
  const id = c.req.param('id')
  const post = await postService.publish(id)
  return c.json({ data: post })
})

export default app
```

Register it in `apps/api/src/index.ts`:

```ts
import postPublish from './routes/posts/publish'
app.route('/api/posts', postPublish)
```

---

## Hooks & Lifecycle Events

Model hooks let you intercept CRUD operations:

```ts
defineModel('Order', fields, {
  hooks: {
    beforeCreate: async (data, ctx) => {
      // Validate stock availability
      const product = await productService.findById(data.productId)
      if (product.stock < data.quantity) {
        throw new ShipError('INSUFFICIENT_STOCK', 'Not enough stock')
      }
      return data
    },

    afterCreate: async (order, ctx) => {
      // Send confirmation email
      await emailService.sendOrderConfirmation(order, ctx.user)
      // Decrement stock
      await productService.decrementStock(order.productId, order.quantity)
    },

    beforeDelete: async (id, ctx) => {
      // Prevent deletion of paid orders
      const order = await orderService.findById(id)
      if (order.paymentStatus === 'paid') {
        throw new ShipError('CANNOT_DELETE_PAID_ORDER', 'Cannot delete paid orders')
      }
    },
  }
})
```

---

## Soft Delete

Enable soft delete on any model:

```ts
defineModel('Post', fields, {
  softDelete: true,  // adds 'deletedAt' field
})
```

- `DELETE /api/posts/:id` sets `deletedAt = new Date()` instead of removing
- All queries automatically add `{ deletedAt: null }` to the Mongoose filter
- `GET /api/posts?includeDeleted=true` (admin only) shows deleted records
- `POST /api/posts/:id/restore` — restore a soft-deleted record

---

## Audit Log

Track who changed what and when:

```ts
defineModel('Product', fields, {
  auditLog: true,
})
```

Ship creates an `AuditLog` **collection** and records:
- Who made the change (`userId` — ObjectId reference to User)
- What changed (field-level diff using deep equality)
- When it happened
- The operation type (create/update/delete)

View audit logs in the admin UI at `/admin/products/:id/history`.
