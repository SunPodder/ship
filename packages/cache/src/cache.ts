/**
 * Cache manager — the strategy-aware façade over a `CacheAdapter`. It owns the
 * `remember()` read strategies, deterministic key generation, and tag
 * registration so callers never touch raw cache keys.
 *
 * Tag registration prefers the adapter's native index (`addTag`) so Redis
 * invalidation works across processes; adapters without it fall back to an
 * in-process `Map<tag, Set<key>>`.
 */

import type { CacheAdapter } from './adapter';

export type CacheStrategy =
  | 'cache-first'
  | 'stale-while-revalidate'
  | 'network-first'
  | 'no-cache';

export interface CacheOptions {
  /** Default TTL in seconds used when `set`/`remember` omit one. Default 60. */
  defaultTTL?: number;
}

export interface Cache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl?: number, tags?: string[]): Promise<void>;
  del(key: string): Promise<void>;
  invalidateTag(tag: string): Promise<void>;
  invalidateTags(tags: string[]): Promise<void>;
  flush(): Promise<void>;
  remember<K>(
    cacheKey: string,
    ttlSeconds: number | undefined,
    tags: string[] | undefined,
    strategy: CacheStrategy | undefined,
    fn: () => Promise<K>,
  ): Promise<K>;
}

/**
 * Builds a deterministic cache key from a model, operation, and params.
 * Object params are serialized with keys sorted so `{ a: 1, b: 2 }` and
 * `{ b: 2, a: 1 }` produce the same key; non-object params serialize directly.
 */
export function key(model: string, operation: string, params?: unknown): string {
  return `${model}:${operation}:${serializeParams(params)}`;
}

function serializeParams(params: unknown): string {
  if (params === null || params === undefined) return '{}';
  if (typeof params === 'object') {
    if (Array.isArray(params)) return JSON.stringify(params);
    return stableStringify(params);
  }
  if (typeof params === 'string') return params;
  return JSON.stringify(params);
}

/** JSON.stringify with recursively sorted object keys (and JSON's undefined handling). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? 'null' : stableStringify(item)))
      .join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const parts: string[] = [];
    for (const name of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[name];
      if (nested === undefined) continue;
      parts.push(`${JSON.stringify(name)}:${stableStringify(nested)}`);
    }
    return `{${parts.join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 'null' : serialized;
}

export function createCache(adapter: CacheAdapter, options?: CacheOptions): Cache {
  const defaultTTL = options?.defaultTTL ?? 60;
  const hasNativeTags = typeof adapter.addTag === 'function';

  // Fallback tag index for adapters without native tag tracking.
  const fallbackTags = new Map<string, Set<string>>();

  async function registerTag(keyName: string, tag: string): Promise<void> {
    if (hasNativeTags) {
      await adapter.addTag!(keyName, tag);
      return;
    }
    let keys = fallbackTags.get(tag);
    if (keys === undefined) {
      keys = new Set();
      fallbackTags.set(tag, keys);
    }
    keys.add(keyName);
  }

  async function setEntry(
    keyName: string,
    value: unknown,
    ttl: number,
    tags?: string[],
  ): Promise<void> {
    await adapter.set(keyName, value, ttl);
    if (tags !== undefined && tags.length > 0) {
      await Promise.all(tags.map((tag) => registerTag(keyName, tag)));
    }
  }

  async function invalidateTag(tag: string): Promise<void> {
    if (hasNativeTags) {
      await adapter.invalidateTag(tag);
      return;
    }
    const keys = fallbackTags.get(tag);
    if (keys === undefined) return;
    await Promise.all([...keys].map((keyName) => adapter.del(keyName)));
    fallbackTags.delete(tag);
  }

  return {
    get(keyName) {
      return adapter.get(keyName);
    },

    set(keyName, value, ttl = defaultTTL, tags) {
      return setEntry(keyName, value, ttl, tags);
    },

    del(keyName) {
      return adapter.del(keyName);
    },

    invalidateTag,

    async invalidateTags(tags) {
      await Promise.all(tags.map((tag) => invalidateTag(tag)));
    },

    async flush() {
      fallbackTags.clear();
      await adapter.flush();
    },

    async remember<K>(
      cacheKey: string,
      ttlSeconds: number | undefined,
      tags: string[] | undefined,
      strategy: CacheStrategy | undefined,
      fn: () => Promise<K>,
    ): Promise<K> {
      const ttl = ttlSeconds ?? defaultTTL;
      const effective = strategy ?? 'cache-first';

      switch (effective) {
        case 'no-cache':
          return fn();

        case 'network-first': {
          try {
            const value = await fn();
            await setEntry(cacheKey, value, ttl, tags);
            return value;
          } catch (error) {
            const cached = await adapter.get(cacheKey);
            if (cached === null || cached === undefined) throw error;
            return cached as K;
          }
        }

        // With adapters that evict expired entries (memory, Redis), a stale
        // read is indistinguishable from a miss, so both collapse to a
        // read-through. Adapters that retain stale values would return them
        // here instead of revalidating.
        case 'stale-while-revalidate':
        case 'cache-first': {
          const cached = await adapter.get(cacheKey);
          if (cached !== null && cached !== undefined) return cached as K;
          const value = await fn();
          await setEntry(cacheKey, value, ttl, tags);
          return value;
        }
      }
    },
  };
}
