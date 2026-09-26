/**
 * Cache package tests — memory adapter (LRU, TTL, tag invalidation) and the
 * deterministic `key()` builder, plus the strategy behaviours of `createCache`.
 * No live Redis is required.
 */
import { describe, expect, it } from 'bun:test';

import { createCache, createMemoryAdapter, key } from '../src/index';

describe('createMemoryAdapter', () => {
  it('round-trips a value through get and set', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('greeting', { hello: 'world' }, 60);
    expect(await adapter.get('greeting')).toEqual({ hello: 'world' });
  });

  it('returns null for a missing key', async () => {
    const adapter = createMemoryAdapter();
    expect(await adapter.get('absent')).toBeNull();
  });

  it('evicts entries with a negative ttl immediately', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('k', 'value', -1);
    expect(await adapter.get('k')).toBeNull();
  });

  it('evicts the least recently used entry at maxSize', async () => {
    const adapter = createMemoryAdapter({ maxSize: 2 });
    await adapter.set('a', 1, 60);
    await adapter.set('b', 2, 60);
    await adapter.set('c', 3, 60);
    expect(await adapter.get('a')).toBeNull();
    expect(await adapter.get('b')).toBe(2);
    expect(await adapter.get('c')).toBe(3);
  });

  it('refreshes recency on get', async () => {
    const adapter = createMemoryAdapter({ maxSize: 2 });
    await adapter.set('a', 1, 60);
    await adapter.set('b', 2, 60);
    expect(await adapter.get('a')).toBe(1);
    await adapter.set('c', 3, 60); // evicts 'b', the now-least-recently-used key
    expect(await adapter.get('a')).toBe(1);
    expect(await adapter.get('b')).toBeNull();
  });

  it('invalidateTag purges every key registered with the tag', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('posts:single:1', { id: 1 }, 60);
    await adapter.set('posts:single:2', { id: 2 }, 60);
    await adapter.set('other', { id: 3 }, 60);
    await adapter.addTag('posts:single:1', 'posts');
    await adapter.addTag('posts:single:2', 'posts');

    await adapter.invalidateTag('posts');

    expect(await adapter.get('posts:single:1')).toBeNull();
    expect(await adapter.get('posts:single:2')).toBeNull();
    expect(await adapter.get('other')).toEqual({ id: 3 });
  });

  it('flush clears everything including the tag index', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('a', 1, 60);
    await adapter.addTag('a', 'tag');
    await adapter.flush();
    expect(await adapter.get('a')).toBeNull();
    // A fresh tag with no keys is a no-op.
    await adapter.invalidateTag('tag');
  });
});

describe('key', () => {
  it('sorts object keys for a deterministic result', () => {
    expect(key('posts', 'list', { status: 'published', page: 2 })).toBe(
      'posts:list:{"page":2,"status":"published"}',
    );
  });

  it('is insensitive to object key insertion order', () => {
    expect(key('posts', 'list', { page: 2, status: 'published' })).toBe(
      key('posts', 'list', { status: 'published', page: 2 }),
    );
  });

  it('serializes nested object keys deterministically too', () => {
    expect(key('posts', 'list', { filter: { b: 1, a: 2 } })).toBe(
      'posts:list:{"filter":{"a":2,"b":1}}',
    );
  });

  it('defaults missing params to an empty object', () => {
    expect(key('posts', 'list')).toBe('posts:list:{}');
  });

  it('serializes non-object params directly', () => {
    expect(key('posts', 'single', 'abc-123')).toBe('posts:single:abc-123');
    expect(key('posts', 'single', 42)).toBe('posts:single:42');
  });
});

describe('createCache strategies', () => {
  it('cache-first serves from cache without re-invoking fn', async () => {
    const cache = createCache(createMemoryAdapter());
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { data: [1] };
    };

    const first = await cache.remember('posts:list', 60, ['posts'], 'cache-first', fn);
    const second = await cache.remember('posts:list', 60, ['posts'], 'cache-first', fn);

    expect(first).toEqual({ data: [1] });
    expect(second).toEqual({ data: [1] });
    expect(calls).toBe(1);
  });

  it('network-first returns fresh data and caches it', async () => {
    const cache = createCache(createMemoryAdapter());
    const fresh = await cache.remember('k', 60, undefined, 'network-first', async () => 'fresh');

    expect(fresh).toBe('fresh');

    // A subsequent cache-first read hits the freshly stored value.
    const cached = await cache.remember('k', 60, undefined, 'cache-first', async () => 'never');
    expect(cached).toBe('fresh');
  });

  it('network-first falls back to cached value when fn throws', async () => {
    const cache = createCache(createMemoryAdapter());
    await cache.set('k', 'cached', 60);

    const result = await cache.remember('k', 60, undefined, 'network-first', async () => {
      throw new Error('down');
    });

    expect(result).toBe('cached');
  });

  it('network-first rethrows when fn throws and nothing is cached', async () => {
    const cache = createCache(createMemoryAdapter());
    await expect(
      cache.remember('k', 60, undefined, 'network-first', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
  });

  it('stale-while-revalidate returns the stale value immediately', async () => {
    const cache = createCache(createMemoryAdapter());
    await cache.set('k', 'stale', 60);
    let called = false;

    const result = await cache.remember('k', 60, undefined, 'stale-while-revalidate', async () => {
      called = true;
      return 'fresh';
    });

    expect(result).toBe('stale');
    expect(called).toBe(false);
  });

  it('no-cache always invokes fn without caching', async () => {
    const cache = createCache(createMemoryAdapter());
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return calls;
    };

    expect(await cache.remember('k', 60, undefined, 'no-cache', fn)).toBe(1);
    expect(await cache.remember('k', 60, undefined, 'no-cache', fn)).toBe(2);
    expect(await cache.get('k')).toBeNull();
  });

  it('set registers keys with tags so invalidateTag purges them', async () => {
    const cache = createCache(createMemoryAdapter());
    await cache.set('posts:single:1', { id: 1 }, 60, ['posts']);
    await cache.set('posts:single:2', { id: 2 }, 60, ['posts']);

    await cache.invalidateTag('posts');

    expect(await cache.get('posts:single:1')).toBeNull();
    expect(await cache.get('posts:single:2')).toBeNull();
  });

  it('invalidateTags purges multiple tags at once', async () => {
    const cache = createCache(createMemoryAdapter());
    await cache.set('a', 1, 60, ['one']);
    await cache.set('b', 2, 60, ['two']);

    await cache.invalidateTags(['one', 'two']);

    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });
});
