# File Uploads

Ship provides a unified file storage system with adapters for local disk, AWS S3, and Cloudflare R2. File fields are defined in your model schema and handled automatically by the API.

---

## Field Types

```ts
// Single image
avatar: field.image({
  storage:  'r2',              // adapter name
  nullable: true,
  maxSize:  '5mb',
  // Auto-generate thumbnails (uses sharp)
  sizes: {
    thumb:  { width: 100, height: 100, fit: 'cover' },
    medium: { width: 800 },
    large:  { width: 1920 },
  },
  accept: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
})

// Multiple images
gallery: field.image({
  storage: 'r2',
  many:    true,
  maxFiles: 10,
  maxSize: '10mb',
})

// Generic file
attachment: field.file({
  storage: 'r2',
  accept:  ['.pdf', '.docx', '.xlsx'],
  maxSize: '25mb',
  nullable: true,
})

// Video
video: field.file({
  storage: 'r2',
  accept:  ['video/mp4', 'video/webm'],
  maxSize: '500mb',
})
```

---

## Upload Endpoint

Ship auto-generates upload endpoints for each file field:

```
POST /api/upload
Content-Type: multipart/form-data

field: "avatar"
file: <binary>
```

Response:

```json
{
  "data": {
    "url":      "https://cdn.myapp.com/avatars/abc123.webp",
    "key":      "avatars/abc123.webp",
    "mimeType": "image/webp",
    "size":     45231,
    "width":    800,
    "height":   600,
    "sizes": {
      "thumb":  "https://cdn.myapp.com/avatars/abc123-thumb.webp",
      "medium": "https://cdn.myapp.com/avatars/abc123-medium.webp"
    }
  }
}
```

The returned `key` is stored in the database. URLs are resolved at query time from the storage adapter.

---

## Storage Adapters

### Local (development)

```ts
storage: {
  adapters: {
    local: {
      uploadDir: './uploads',
      publicUrl: 'http://localhost:3001/uploads',
    }
  }
}
```

Files are served via `GET /uploads/*` on the Hono server.

> ⚠️ Local storage is for development only. Use S3 or R2 in production.

### Cloudflare R2

```ts
storage: {
  adapters: {
    r2: {
      accountId:       process.env.CF_ACCOUNT_ID,
      accessKeyId:     process.env.CF_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
      bucket:          process.env.CF_R2_BUCKET,
      // Custom domain for public access
      publicUrl:       'https://cdn.myapp.com',
    }
  }
}
```

### AWS S3

```ts
storage: {
  adapters: {
    s3: {
      region:          process.env.AWS_REGION,
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket:          process.env.AWS_S3_BUCKET,
      // Optional CloudFront URL
      publicUrl:       process.env.CLOUDFRONT_URL,
    }
  }
}
```

---

## Admin UI Upload Widget

In the generated admin forms, image and file fields render as:

- **Image**: drag-and-drop zone with preview, crop tool, thumbnail previews
- **File**: drag-and-drop zone with file type validation and size indicator
- **Multiple**: reorderable gallery grid with bulk upload support

---

## Frontend Upload Component

```tsx
import { ShipImageUpload, ShipFileUpload } from '@ship/ui'

// Image with preview
<ShipImageUpload
  name="avatar"
  label="Profile Picture"
  sizes={['thumb', 'medium']}
  onUpload={(result) => form.setValue('avatarKey', result.key)}
/>

// File
<ShipFileUpload
  name="attachment"
  label="Attachment"
  accept={['.pdf', '.docx']}
  maxSize="25mb"
  onUpload={(result) => form.setValue('attachmentKey', result.key)}
/>
```

---

## Direct Uploads (Presigned URLs)

For large files, upload directly from the browser to S3/R2 (bypassing the API server):

```ts
// 1. Get a presigned upload URL from the API
const { uploadUrl, key } = await ship.upload.getPresignedUrl({
  field:    'video',
  filename: file.name,
  mimeType: file.type,
  size:     file.size,
})

// 2. Upload directly to S3/R2
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
})

// 3. Save the key to your record
await ship.post.update(postId, { videoKey: key })
```

---

## Image Optimization

Ship uses **sharp** for server-side image processing:

```ts
storage: {
  images: {
    optimize:        true,
    quality:         80,
    formats:         ['webp'],         // convert all uploads to webp
    stripMetadata:   true,             // remove EXIF data
    progressive:     true,
  }
}
```

On upload, Ship automatically:
1. Validates file type and size
2. Strips EXIF metadata (privacy)
3. Converts to WebP (or configured format)
4. Generates all configured size variants
5. Uploads originals + variants to storage
6. Returns URLs for all variants
