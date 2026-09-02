# Search & Filtering

Ship provides built-in search and filtering capabilities for every model. For simple use cases it uses database full-text search. For advanced search (typo tolerance, facets, relevance ranking) it integrates with Meilisearch.

---

## Built-in DB Full-Text Search

Enabled per-field with `searchable: true`:

```ts
defineModel('Post', {
  title:   field.text({ searchable: true }),
  excerpt: field.text({ searchable: true }),
  body:    field.richText(),            // NOT searchable by default
  tags:    field.relation('Tag', { many: true }),
})
```

**Usage:**

```
GET /api/posts?q=nextjs+tutorial
```

Ship builds a `to_tsvector` query (PostgreSQL) or `LIKE` query (SQLite/MySQL) across all `searchable` fields.

**Response includes a relevance score** when `q` is provided:

```json
{
  "data": [
    { "id": "...", "title": "Next.js Tutorial", "_score": 0.98 },
    { "id": "...", "title": "Getting Started", "_score": 0.72 }
  ]
}
```

---

## Configuring Search

```ts
defineModel('Post', fields, {
  search: {
    // Which fields to search and their weights
    fields: {
      title:   { weight: 'A' },   // highest priority
      excerpt: { weight: 'B' },
      tags:    { weight: 'C', relation: 'name' }, // search relation field
    },

    // Minimum query length
    minLength: 2,

    // Include relation data in search index
    indexRelations: ['author.name', 'tags.name'],

    // Language for full-text stemming (PostgreSQL)
    language: 'english',
  }
})
```

---

## Meilisearch Integration

For typo-tolerant, instant search with facets, install the plugin:

```bash
ship add search
```

Configure in `ship.config.ts`:

```ts
search: {
  adapter: 'meilisearch',
  url:     process.env.MEILISEARCH_URL,
  apiKey:  process.env.MEILISEARCH_API_KEY,
}
```

Then enable per-model:

```ts
defineModel('Post', fields, {
  search: {
    adapter: 'meilisearch',
    // Fields to index in Meilisearch
    indexedFields: ['title', 'excerpt', 'tags.name', 'author.name'],
    // Fields used as filters/facets
    filterableFields: ['status', 'tags.id', 'author.id'],
    // Fields used for sorting
    sortableFields: ['publishedAt', 'createdAt', 'title'],
    // Meilisearch ranking rules
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  }
})
```

**Sync is automatic**: when a Post is created/updated/deleted, the Meilisearch index is updated via Ship's `afterCreate`/`afterUpdate`/`afterDelete` hooks.

**Initial index:**

```bash
ship search:index          # index all models
ship search:index Post     # index specific model
ship search:clear Post     # clear index for model
```

---

## Faceted Search

With Meilisearch, facets enable UI filters with counts:

```
GET /api/posts?q=javascript&facets=status,tags,author
```

Response:

```json
{
  "data": [ ... ],
  "meta": {
    "total": 47,
    "facets": {
      "status": {
        "published": 42,
        "draft": 5
      },
      "tags": {
        "javascript": 30,
        "typescript": 20,
        "react": 15
      }
    }
  }
}
```

---

## Filtering in Detail

All query parameters for the list endpoint:

### Equality

```
?status=published
?authorId=user-uuid
```

### Operators

```
?price[gte]=100&price[lte]=500
?createdAt[gte]=2024-01-01T00:00:00Z
?title[contains]=ship
?title[startsWith]=Intro
?tags[in]=tag-id-1,tag-id-2
?authorId[nin]=excluded-user-id
?publishedAt[null]=false
```

### Relation Filters

Filter by related model fields using dot notation:

```
?author.role=editor
?author.email[endsWith]=@company.com
?tags.name[in]=javascript,typescript
```

### Boolean Combinations

```
?status=published&author.role=editor    (AND — default)
```

For OR conditions, use the `or` parameter:

```
?or[0][status]=published&or[0][status]=draft
```

Or using the SDK:

```ts
ship.post.findMany({
  where: {
    OR: [
      { status: 'published' },
      { status: 'draft', authorId: currentUser.id }
    ]
  }
})
```

---

## Sorting

```
?sort=title                    # ascending
?sort=-publishedAt             # descending
?sort=-publishedAt,title       # multi-sort
?sort=author.name              # sort by relation field
```

---

## Pagination

### Offset-based (default)

```
?page=2&limit=20
```

Good for: admin UIs, numbered page controls.

### Cursor-based

```
?cursor=eyJpZCI6ImFiYyJ9&limit=20
```

Good for: infinite scroll, feeds, large datasets.

**Enable cursor pagination per model:**

```ts
defineModel('Post', fields, {
  pagination: {
    default: 'cursor',   // 'offset' | 'cursor'
    defaultLimit: 20,
    maxLimit: 100,
  }
})
```

---

## SDK Search

```ts
// Simple search
const results = await ship.post.search('nextjs tutorial', {
  include: ['author', 'tags'],
  where: { status: 'published' },
})

// Faceted search (Meilisearch)
const results = await ship.post.search('javascript', {
  facets: ['status', 'tags', 'author'],
  filter: { status: 'published' },
})

// results.facets → { status: { published: 42 }, ... }
```

---

## Search UI Components

```tsx
import { ShipSearchBar, ShipFacets } from '@ship/ui'

export function PostSearchPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})

  const { data, meta } = useShip.post.search(query, { facets: ['status', 'tags'], filter: filters })

  return (
    <div>
      <ShipSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search posts..."
        debounce={200}
      />

      <ShipFacets
        facets={meta?.facets}
        value={filters}
        onChange={setFilters}
      />

      <PostList posts={data} />
    </div>
  )
}
```
