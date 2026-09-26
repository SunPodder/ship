/**
 * Media upload route.
 *
 * Registers `POST /upload`: parse the multipart body, optimize the uploaded
 * file through the storage pipeline, persist the main image plus any named
 * variants via a local storage adapter, and return the public URLs.
 */

import { Hono } from 'hono';
import { optimizeImage, createLocalStorageAdapter } from '@ship/storage';

export interface UploadRouteOptions {
  uploadDir?: string;
  publicUrl?: string;
}

/**
 * Registers the `POST /upload` endpoint on `app`.
 *
 * The body must carry a single `file` field. The file is optimized to WebP
 * and stored (alongside its named variants, if any) under a randomized key.
 */
export function registerUploadRoute(app: Hono, opts: UploadRouteOptions = {}): void {
  app.post('/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!(file instanceof File)) {
      return c.json({ error: 'UPLOAD_ERROR', message: 'Missing "file" field' }, 400);
    }

    const input = new Uint8Array(await file.arrayBuffer());
    const optimized = await optimizeImage(input);

    const key = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

    const adapter = createLocalStorageAdapter({
      uploadDir: opts.uploadDir ?? './uploads',
      publicUrl: opts.publicUrl ?? 'http://localhost:3001/uploads',
    });

    const { url } = await adapter.upload(
      { data: optimized.buffer, filename: file.name, mimeType: optimized.mimeType },
      key,
    );

    const sizes: Record<string, { url: string; width: number; height: number }> = {};
    for (const variant of optimized.variants) {
      const variantKey = `${key}-${variant.name}`;
      const variantUpload = await adapter.upload(
        { data: variant.buffer, filename: variant.name, mimeType: optimized.mimeType },
        variantKey,
      );
      sizes[variant.name] = {
        url: variantUpload.url,
        width: variant.width,
        height: variant.height,
      };
    }

    return c.json({
      data: {
        key,
        url,
        mimeType: optimized.mimeType,
        size: optimized.size,
        width: optimized.width,
        height: optimized.height,
        sizes,
      },
    });
  });
}
