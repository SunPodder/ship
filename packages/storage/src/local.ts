/**
 * Local filesystem storage adapter — stores uploads under a directory on disk
 * and serves them via a public base URL. `getSignedUrl` simply returns the
 * public URL because a local filesystem has no signing to perform.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { StorageAdapter } from './adapter';

export interface LocalStorageOptions {
  /** Directory files are written to. */
  uploadDir: string;
  /** Public base URL files are served from (trailing slash is trimmed). */
  publicUrl: string;
}

/** Creates a `StorageAdapter` that persists uploads to the local filesystem. */
export function createLocalStorageAdapter(opts: LocalStorageOptions): StorageAdapter {
  const { uploadDir, publicUrl } = opts;
  const baseUrl = publicUrl.replace(/\/+$/, '');

  return {
    async upload(file, key) {
      const destination = join(uploadDir, key);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.data);
      return { key, url: `${baseUrl}/${key}` };
    },

    async delete(key) {
      // force: true ignores a missing file (ENOENT).
      await rm(join(uploadDir, key), { force: true });
    },

    async getSignedUrl(key) {
      return `${baseUrl}/${key}`;
    },
  };
}
