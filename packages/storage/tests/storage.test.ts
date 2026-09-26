/**
 * Storage package tests — the sharp-backed image optimization pipeline and the
 * local filesystem adapter. No network or external services are required.
 */
import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

import { createLocalStorageAdapter, imageMetadata, optimizeImage } from '../src/index';

/** A tiny 4x3 opaque-red PNG for exercising the pipeline deterministically. */
function makePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 3,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe('optimizeImage', () => {
  it('converts a PNG to WebP with a thumb variant and reports source dimensions', async () => {
    const png = await makePng();

    const result = await optimizeImage(png, {
      format: 'webp',
      sizes: [{ name: 'thumb', width: 2 }],
    });

    expect(result.format).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.size).toBe(result.buffer.length);

    expect(result.variants).toHaveLength(1);
    const thumb = result.variants[0];
    expect(thumb.name).toBe('thumb');
    expect(thumb.width).toBe(2);
    expect(thumb.height).toBeGreaterThan(0);
    expect(thumb.buffer.length).toBeGreaterThan(0);
    expect(thumb.size).toBe(thumb.buffer.length);

    const meta = await imageMetadata(png);
    expect(meta.width).toBe(4);
    expect(meta.height).toBe(3);
    expect(meta.format).toBe('png');
    expect(meta.mimeType).toBe('image/png');
  });
});

describe('createLocalStorageAdapter', () => {
  it('round-trips a file to disk, serves its URL, and deletes it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ship-storage-'));
    try {
      const adapter = createLocalStorageAdapter({
        uploadDir: dir,
        publicUrl: 'https://cdn.example.com/uploads/',
      });

      const file = { data: Buffer.from('hello storage'), filename: 'a.txt', mimeType: 'text/plain' };
      const uploaded = await adapter.upload(file, 'a/b.txt');
      expect(uploaded.key).toBe('a/b.txt');
      expect(uploaded.url).toBe('https://cdn.example.com/uploads/a/b.txt');

      expect(await readFile(join(dir, 'a', 'b.txt'), 'utf8')).toBe('hello storage');
      expect(await adapter.getSignedUrl('a/b.txt')).toBe('https://cdn.example.com/uploads/a/b.txt');

      await adapter.delete('a/b.txt');
      await expect(readFile(join(dir, 'a', 'b.txt'))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('delete ignores a missing key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ship-storage-'));
    try {
      const adapter = createLocalStorageAdapter({ uploadDir: dir, publicUrl: 'http://localhost:4000' });
      await expect(adapter.delete('missing.txt')).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
