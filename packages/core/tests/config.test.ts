import { describe, expect, it } from 'bun:test';
import { defineConfig } from '../src/config';
import { defineModel, field } from '../src/index';

describe('defineConfig', () => {
  it('defaults models to an empty array', () => {
    const config = defineConfig({});
    expect(config.models).toEqual([]);
  });

  it('preserves the provided models and settings', () => {
    const Post = defineModel('Post', { title: field.text() });
    const config = defineConfig({
      models: [Post],
      database: { adapter: 'mongodb' },
      cache: { adapter: 'redis' },
      api: { prefix: '/api', port: 3001 },
    });
    expect(config.models).toHaveLength(1);
    expect(config.models[0].name).toBe('Post');
    expect(config.database?.adapter).toBe('mongodb');
    expect(config.cache?.adapter).toBe('redis');
    expect(config.api?.port).toBe(3001);
  });
});
