/**
 * Ship API application factory.
 *
 * Builds a Hono app serving a REST CRUD API for every Ship model definition:
 *
 *   GET    /api/<collection>?q=&sort=&limit=&offset=&filter=
 *   GET    /api/<collection>/:id
 *   POST   /api/<collection>
 *   PATCH  /api/<collection>/:id
 *   DELETE /api/<collection>/:id
 *
 * `createApp()` is a pure factory — no side effects and no project-config
 * import — so it can be imported and booted in isolation (from tests,
 * alternative entry points, or embedded contexts).
 */

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import mongoose, { type Model } from 'mongoose';
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

/** Resolved per-model caching settings handed to the service layer. */
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

/* ─────────────────────────── Serialization ─────────────────────────── */

/** Recursively coerce Mongoose/BSON values into JSON-safe primitives. */
function serializeValue(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof mongoose.Types.Decimal128) return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

/** Map a lean/tObject doc into the API shape: `{ id, ...fields, createdAt, updatedAt }`. */
function serializeDoc(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (doc == null) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') {
      out.id = serializeValue(value);
      continue;
    }
    if (key === '__v') continue;
    out[key] = serializeValue(value);
  }
  return out;
}

/* ─────────────────────────── Service layer ─────────────────────────── */

/** Transport-agnostic CRUD contract the REST routes delegate to. */
export interface ServiceApi {
  list(model: string, args: Record<string, unknown>): Promise<unknown[]>;
  get(model: string, id: string): Promise<unknown | null>;
  create(model: string, input: Record<string, unknown>): Promise<unknown>;
  update(
    model: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<unknown | null>;
  remove(model: string, id: string): Promise<boolean>;
}

/**
 * Build the service layer the REST routes delegate to. Reads flow through the
 * cache manager (caching JSON-safe serialized docs); writes invalidate tags.
 */
export function makeService(
  models: ModelDefinition[],
  modelsMap: Record<string, Model<any>>,
  cache: Cache,
): ServiceApi {
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

      const docs = await cache.remember(
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
            .lean()
            .then((rows) =>
              (rows as Record<string, unknown>[]).map(serializeDoc),
            ),
      );
      return docs as unknown[];
    },

    async get(model, id) {
      const { ttl, tags } = configFor(model);
      const doc = await cache.remember(
        key(model, 'single', id),
        ttl,
        tags,
        'cache-first',
        () =>
          modelsMap[model]
            .findById(id)
            .lean()
            .then((d) => serializeDoc(d as Record<string, unknown> | null)),
      );
      return doc as unknown | null;
    },

    async create(model, input) {
      const doc = await modelsMap[model].create(input);
      await cache.invalidateTags(configFor(model).tags);
      return serializeDoc(doc.toObject() as Record<string, unknown>);
    },

    async update(model, id, input) {
      const doc = await modelsMap[model]
        .findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
        .lean();
      await cache.invalidateTags(configFor(model).tags);
      return serializeDoc(doc as Record<string, unknown> | null);
    },

    async remove(model, id) {
      await modelsMap[model].findByIdAndDelete(id);
      await cache.invalidateTags(configFor(model).tags);
      return true;
    },
  };
}

/* ─────────────────────────── HTTP layer ─────────────────────────── */

/** Parse list query params into the service `list` args shape. */
function parseListArgs(c: Context): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const q = c.req.query('q');
  if (q) args.q = q;
  const sort = c.req.query('sort');
  if (sort) args.sort = sort;
  const limit = c.req.query('limit');
  if (limit) args.limit = limit;
  const offset = c.req.query('offset');
  if (offset) args.offset = offset;
  const filter = c.req.query('filter');
  if (filter) {
    try {
      args.filter = JSON.parse(filter);
    } catch {
      // Ignore malformed filter; the service treats a missing filter as `{}`.
    }
  }
  return args;
}

function notFound(c: Context, collection: string): Response {
  return c.json(
    { error: 'NOT_FOUND', message: `Unknown collection "${collection}"` },
    404,
  );
}

/**
 * Build the full Hono app: `/health`, the auth routes, the upload route, and
 * REST CRUD routes for every configured model.
 */
export function createApp(config: { models: ModelDefinition[] }): Hono {
  const models = config.models;
  const modelsMap = compileModels(models);
  const cache = createCache(createMemoryAdapter({ maxSize: 1000 }), {
    defaultTTL: 300,
  });
  const service = makeService(models, modelsMap, cache);

  const modelByCollection: Record<string, ModelDefinition> = {};
  for (const model of models) {
    modelByCollection[model.collection] = model;
  }

  const app = new Hono();
  app.use('*', cors());

  const User =
    mongoose.models.User ??
    mongoose.model(
      'User',
      buildMongooseSchema(BUILTIN_USER_FIELDS, { timestamps: true }),
    );
  app.route(
    '/',
    createAuthApp(User, process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me'),
  );

  app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }));

  app.get('/api/:collection', async (c) => {
    const model = modelByCollection[c.req.param('collection')];
    if (!model) return notFound(c, c.req.param('collection'));
    const rows = await service.list(model.name, parseListArgs(c));
    return c.json({ data: rows });
  });

  app.get('/api/:collection/:id', async (c) => {
    const model = modelByCollection[c.req.param('collection')];
    if (!model) return notFound(c, c.req.param('collection'));
    const doc = await service.get(model.name, c.req.param('id'));
    return c.json({ data: doc });
  });

  app.post('/api/:collection', async (c) => {
    const model = modelByCollection[c.req.param('collection')];
    if (!model) return notFound(c, c.req.param('collection'));
    const input =
      (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const doc = await service.create(model.name, input ?? {});
    return c.json({ data: doc }, 201);
  });

  app.patch('/api/:collection/:id', async (c) => {
    const model = modelByCollection[c.req.param('collection')];
    if (!model) return notFound(c, c.req.param('collection'));
    const input =
      (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const doc = await service.update(model.name, c.req.param('id'), input ?? {});
    return c.json({ data: doc });
  });

  app.delete('/api/:collection/:id', async (c) => {
    const model = modelByCollection[c.req.param('collection')];
    if (!model) return notFound(c, c.req.param('collection'));
    const ok = await service.remove(model.name, c.req.param('id'));
    return c.json({ data: ok });
  });

  // Map uncaught service errors to the `{ error, message }` envelope.
  app.onError((err, c) => {
    if (err instanceof mongoose.Error.ValidationError) {
      return c.json({ error: 'VALIDATION_ERROR', message: err.message }, 422);
    }
    if (
      err instanceof Error &&
      err.name === 'MongoServerError' &&
      'code' in err &&
      typeof err.code === 'number' &&
      err.code === 11000
    ) {
      return c.json(
        { error: 'CONFLICT', message: 'A record with that unique value already exists.' },
        409,
      );
    }
    console.error(err);
    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Internal server error',
      },
      500,
    );
  });

  registerUploadRoute(app);
  return app;
}
