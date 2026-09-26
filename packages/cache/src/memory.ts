/**
 * In-memory cache adapter backed by `lru-cache`. Used for local development
 * and edge fallbacks — it is process-local and never shared across servers.
 *
 * Entries expire after a default TTL (60s) and the cache evicts the least
 * recently used entry once `maxSize` is reached. Tag indexes are kept in a
 * `Map<tag, Set<key>>` so `invalidateTag` purges every key in one pass.
 */
import { LRUCache } from 'lru-cache';

import type { CacheAdapter } from './adapter';

export interface MemoryAdapterOptions {
  /** Maximum number of entries before LRU eviction kicks in. Default 1000. */
  maxSize?: number;
  /** Default TTL in seconds applied when a caller does not specify one. Default 60. */
  ttlSeconds?: number;
}

export function createMemoryAdapter(options?: MemoryAdapterOptions): CacheAdapter {
  const maxSize = options?.maxSize ?? 1000;
  const defaultTTLSeconds = options?.ttlSeconds ?? 60;

  // `any` because lru-cache forbids null/undefined values, while the adapter
  // contract stores arbitrary `unknown` values. The boundary is kept clean via
  // the `CacheAdapter` return type.
  const store = new LRUCache<string, any>({
    max: maxSize,
    ttl: defaultTTLSeconds * 1000,
    ttlAutopurge: true,
  });

  const tags = new Map<string, Set<string>>();

  return {
    async get(key) {
      const value = store.get(key);
      return value === undefined ? null : value;
    },

    async set(key, value, ttlSeconds) {
      // A non-positive TTL means "already expired": never store it, so reads
      // miss. Avoids handing lru-cache a negative ttl (which trips its
      // ttlAutopurge timer).
      if (ttlSeconds <= 0) {
        store.delete(key);
        return;
      }
      store.set(key, value, { ttl: ttlSeconds * 1000 });
    },

    async del(key) {
      store.delete(key);
    },

    async addTag(key, tag) {
      let keys = tags.get(tag);
      if (keys === undefined) {
        keys = new Set();
        tags.set(tag, keys);
      }
      keys.add(key);
    },

    async invalidateTag(tag) {
      const keys = tags.get(tag);
      if (keys === undefined) return;
      for (const key of keys) {
        store.delete(key);
      }
      tags.delete(tag);
    },

    async flush() {
      store.clear();
      tags.clear();
    },
  };
}
