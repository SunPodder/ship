/**
 * Ship API application factory.
 *
 * Builds a Hono app wired to a GraphQL Yoga schema generated from Ship model
 * definitions. `createApp()` is a pure factory — no side effects and no
 * project-config import — so it can be imported and booted in isolation (from
 * tests, alternative entry points, or embedded contexts).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createYoga } from 'graphql-yoga';
import mongoose, { type Model } from 'mongoose';
import { buildGraphQLSchema, type ServiceResolvers } from '@ship/graphql';
import { buildMongooseSchema } from '@ship/db';
import {
  createCache,
  createMemoryAdapter,
  key,
  type Cache,
  type CacheStrategy,
} from '@ship/cache';
import { BUILTIN_USER_FIELDS, type ModelDefinition } from '@ship/core';
import { registerUploadRoute } from './upload';
import { createAuthApp } from './auth';

/** Resolved per-model caching settings handed to the service resolvers. */
interface ModelCacheConfig {
  ttl: number;
  tags: string[];
  strategy: CacheStrategy;
}

/** Derive a model's cache config from `model.options.cache`, applying defaults. */
function resolveCacheConfig(model: ModelDefinition): ModelCacheConfig {
  const cache = model.options.cache;
  if (cache === false) {
    return { ttl: 300, tags: [model.collection], strategy: 'no-cache' };
  }
  return {
    ttl: cache?.ttl ?? 300,
    tags: cache?.tags ?? [model.collection],
    strategy: cache?.strategy ?? 'cache-first',
  };
}

/**
 * Register every model definition as a Mongoose model, keyed by model name.
 * Duplicate registration (e.g. a second `createApp` call or a hot reload) is
 * tolerated by falling back to the already-registered model.
 */
export function compileModels(models: ModelDefinition[]): Record<string, Model<any>> {
  const compiled: Record<string, Model<any>> = {};
  for (const model of models) {
    try {
      compiled[model.name] = mongoose.model(
        model.name,
        buildMongooseSchema(model.fields, {
          timestamps: true,
          softDelete: model.options.softDelete,
          indexes: model.options.indexes,
        }),
      );
    } catch {
      compiled[model.name] = mongoose.model(model.name);
    }
  }
  return compiled;
}

/**
 * Build the service-layer resolvers the generated GraphQL schema delegates to.
 * Reads flow through the cache manager; writes invalidate the model's tags.
 */
export function makeResolvers(
  models: ModelDefinition[],
  modelsMap: Record<string, Model<any>>,
  cache: Cache,
): ServiceResolvers {
  const configs: Record<string, ModelCacheConfig> = {};
  for (const model of models) {
    configs[model.name] = resolveCacheConfig(model);
  }

  const configFor = (model: string): ModelCacheConfig =>
    configs[model] ?? { ttl: 300, tags: [model], strategy: 'cache-first' };

  /** Names of a model's text fields flagged `searchable: true`. */
  const searchableFields = (model: string): string[] => {
    const definition = models.find((m) => m.name === model);
    if (!definition) return [];
    const fields: string[] = [];
    for (const [fieldName, fieldDef] of Object.entries(definition.fields)) {
      if (fieldDef.kind === 'text' && fieldDef.options.searchable === true) {
        fields.push(fieldName);
      }
    }
    return fields;
  };

  return {
    async list(model, args) {
      const { ttl, tags, strategy } = configFor(model);
      const filter = (args.filter as Record<string, unknown>) ?? {};

      const sort: Record<string, 1 | -1> = {};
      if (typeof args.sort === 'string' && args.sort.length > 0) {
        for (const part of args.sort.split(',')) {
          const field = part.trim();
          if (field.length === 0) continue;
          const desc = field.startsWith('-');
          sort[desc ? field.slice(1) : field] = desc ? -1 : 1;
        }
      }

      const rawLimit = Number(args.limit);
      const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, 100);
      const rawOffset = Number(args.offset);
      const offset = Number.isFinite(rawOffset) ? rawOffset : 0;

      let query: Record<string, unknown> = filter;
      const q = typeof args.q === 'string' ? args.q.trim() : '';
      if (q.length > 0) {
        const searchable = searchableFields(model);
        if (searchable.length > 0) {
          query = {
            ...filter,
            $or: searchable.map((field) => ({
              [field]: { $regex: q, $options: 'i' },
            })),
          };
        }
      }

      return cache.remember(
        key(model, 'list', args),
        ttl,
        tags,
        strategy,
        () =>
          modelsMap[model]
            .find(query)
            .sort(sort)
            .skip(offset)
            .limit(limit)
            .lean(),
      );
    },

    async get(model, id) {
      const { ttl, tags } = configFor(model);
      return cache.remember(
        key(model, 'single', id),
        ttl,
        tags,
        'cache-first',
        () => modelsMap[model].findById(id).lean(),
      );
    },

    async create(model, input) {
      const doc = await modelsMap[model].create(input);
      await cache.invalidateTags(configFor(model).tags);
      return doc.toObject();
    },

    async update(model, id, input) {
      const doc = await modelsMap[model]
        .findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
        .lean();
      await cache.invalidateTags(configFor(model).tags);
      return doc;
    },

    async remove(model, id) {
      await modelsMap[model].findByIdAndDelete(id);
      await cache.invalidateTags(configFor(model).tags);
      return true;
    },
  };
}

/**
 * Build the full Hono app: a `/health` check and a `/graphql` endpoint (with
 * GraphiQL) backed by the compiled models, cache manager, and generated schema.
 */
export function createApp(config: { models: ModelDefinition[] }): Hono {
  const models = config.models;
  const modelsMap = compileModels(models);
  const cache = createCache(createMemoryAdapter({ maxSize: 1000 }), {
    defaultTTL: 300,
  });

  const schema = buildGraphQLSchema(models, makeResolvers(models, modelsMap, cache));
  const yoga = createYoga({ schema, graphiql: true });

  const app = new Hono();
  app.use('*', cors());

  const User =
    mongoose.models.User ??
    mongoose.model('User', buildMongooseSchema(BUILTIN_USER_FIELDS, { timestamps: true }));
  app.route('/', createAuthApp(User, process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me'));

  app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }));
  app.all('/graphql', (c) => yoga.fetch(c.req.raw));
  registerUploadRoute(app);
  return app;
}
