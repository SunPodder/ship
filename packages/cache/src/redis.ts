/**
 * Redis cache adapter. Shared across every server instance, so tags live in
 * Redis `SET`s and `invalidateTag` purges keys set by other processes too.
 *
 * Values are stored as JSON strings; the `tag:<name>` SET holds the (prefixed)
 * keys belonging to each tag. Every key is prefixed with `opts.prefix` so the
 * same Redis database can be shared without collisions.
 */

import type { CacheAdapter } from './adapter';

/**
 * The minimal Redis client surface this adapter needs. `ioredis` satisfies it
 * out of the box; so do in-memory test doubles.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...rest: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  /** Optional: clears the whole database (ioredis `flushdb`). Used by `flush`. */
  flushdb?(): Promise<unknown>;
}

export interface RedisAdapterOptions {
  /** Prepended to every key (and tag key). Default `''`. */
  prefix?: string;
}

export function createRedisAdapter(
  client: RedisLike,
  options?: RedisAdapterOptions,
): CacheAdapter {
  const prefix = options?.prefix ?? '';

  const key = (raw: string): string => `${prefix}${raw}`;
  const tagKey = (tag: string): string => key(`tag:${tag}`);

  return {
    async get(raw) {
      const value = await client.get(key(raw));
      return value === null ? null : JSON.parse(value);
    },

    async set(raw, value, ttlSeconds) {
      await client.set(key(raw), JSON.stringify(value), 'EX', ttlSeconds);
    },

    async del(raw) {
      await client.del(key(raw));
    },

    async addTag(raw, tag) {
      await client.sadd(tagKey(tag), key(raw));
    },

    async invalidateTag(tag) {
      const members = await client.smembers(tagKey(tag));
      if (members.length > 0) {
        await client.del(...members);
      }
      await client.del(tagKey(tag));
    },

    async flush() {
      await client.flushdb?.();
    },
  };
}
