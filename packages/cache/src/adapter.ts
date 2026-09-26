/**
 * CacheAdapter — the storage-agnostic contract every Ship cache backend
 * implements. Values are opaque to the adapter (the caller decides how to
 * serialize them); TTLs are expressed in whole seconds.
 *
 * Tag support: `addTag` is optional. Adapters that keep a native tag index
 * (e.g. an in-memory `Map<tag, Set<key>>` or Redis `SET`s) implement it so
 * `invalidateTag` can purge entries across processes. When it is absent, the
 * cache manager falls back to an in-process tag index.
 */
export interface CacheAdapter {
  /** Returns the cached value, or `null` when the key is absent or expired. */
  get(key: string): Promise<unknown | null>;
  /** Stores `value` under `key`, expiring after `ttlSeconds`. */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Deletes a single key. */
  del(key: string): Promise<void>;
  /** Deletes every key previously associated with `tag`. */
  invalidateTag(tag: string): Promise<void>;
  /** Deletes every cached entry. */
  flush(): Promise<void>;
  /** Associates `key` with `tag` so `invalidateTag` can purge it. Optional. */
  addTag?(key: string, tag: string): Promise<void>;
}
