/**
 * StorageAdapter — the contract every Ship storage backend implements.
 * Adapters receive already-prepared bytes plus their filename/mimeType and are
 * responsible for persisting the upload under `key` and returning a public
 * `url` the client can fetch. `getSignedUrl` is how callers mint time-limited
 * URLs on backends that support signing; local/static backends simply return
 * the public URL.
 */
export interface StorageAdapter {
  /** Persists `file` under `key` and returns the key plus its public URL. */
  upload(
    file: { data: Buffer | Uint8Array; filename: string; mimeType: string },
    key: string,
  ): Promise<{ key: string; url: string }>;
  /** Removes the object stored under `key`, ignoring a missing object. */
  delete(key: string): Promise<void>;
  /** Returns a (optionally time-limited) URL for `key`. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
