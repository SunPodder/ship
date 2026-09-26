/**
 * Model DSL — `defineModel()`, `extendModel()`, and the type-level input
 * mapping that turns a field map into `CreateInput` / `UpdateInput` types.
 */

import { field, type FieldDef, type FieldMap } from './fields';

/* ─────────────────────────── Pluralization ─────────────────────────── */

export function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function pluralize(value: string): string {
  if (/[sxz]$/i.test(value) || /(ch|sh)$/i.test(value)) return value + 'es';
  if (/[^aeiou]y$/i.test(value)) return value.slice(0, -1) + 'ies';
  return value + 's';
}

/* ─────────────────────────── Model options ─────────────────────────── */

export type CacheStrategy =
  | 'cache-first'
  | 'stale-while-revalidate'
  | 'network-first'
  | 'no-cache';

export interface OperationCache {
  ttl?: number;
  strategy?: CacheStrategy;
}

export interface CacheModelOptions {
  ttl?: number;
  strategy?: CacheStrategy;
  tags?: string[];
  list?: OperationCache | false;
  single?: OperationCache | false;
  write?: false;
  invalidateRelated?: string[];
}

export type PermissionValue =
  | 'public'
  | 'authenticated'
  | 'self'
  | 'none'
  | `role:${string}`
  | (string & {});

export type FieldPermission = PermissionValue | PermissionValue[];

export interface ModelPermissions {
  list?: PermissionValue;
  read?: PermissionValue;
  create?: PermissionValue;
  update?: PermissionValue;
  delete?: PermissionValue;
  fields?: Record<string, { read?: FieldPermission; write?: FieldPermission }>;
}

export type Hook = (
  data: unknown,
  ctx: unknown,
) => unknown | Promise<unknown>;

export interface ModelHooks {
  beforeCreate?: Hook;
  afterCreate?: Hook;
  beforeUpdate?: Hook;
  afterUpdate?: Hook;
  beforeDelete?: Hook;
  afterDelete?: Hook;
}

export interface AdminHints {
  listFields?: string[];
  searchField?: string;
  defaultSort?: { field: string; order: 'asc' | 'desc' };
  label?: string;
  pluralLabel?: string;
  description?: string;
  group?: string;
  icon?: string;
  hidden?: boolean;
}

export interface PaginationOptions {
  default?: 'offset' | 'cursor';
  defaultLimit?: number;
  maxLimit?: number;
}

export interface SearchModelOptions {
  fields?: Record<string, { weight?: string; relation?: string }>;
  minLength?: number;
  indexRelations?: string[];
  language?: string;
  adapter?: string;
  indexedFields?: string[];
  filterableFields?: string[];
  sortableFields?: string[];
  rankingRules?: string[];
}

export interface ModelIndex {
  fields: string[];
  unique?: boolean;
  type?: 'text' | '2dsphere' | 'geo2d' | 'hashed' | 'asc' | 'desc' | 'normal';
  name?: string;
}

export interface ComputedField {
  type?: string;
  resolve: (row: Record<string, unknown>) => unknown;
}

export interface VirtualRelation {
  model: string;
  resolve: (
    row: Record<string, unknown>,
    ctx: { model: unknown },
  ) => unknown | Promise<unknown>;
}

export interface ModelOptions {
  id?: 'objectid' | 'uuid' | 'cuid2' | 'nanoid';
  collection?: string;
  indexes?: ModelIndex[];
  softDelete?: boolean;
  cache?: CacheModelOptions | false;
  permissions?: ModelPermissions;
  hooks?: ModelHooks;
  admin?: AdminHints;
  pagination?: PaginationOptions;
  search?: SearchModelOptions;
  auditLog?: boolean;
  computed?: Record<string, ComputedField>;
  virtual?: Record<string, VirtualRelation>;
}

/* ─────────────────────────── Input type mapping ─────────────────────────── */
export type EmbeddedInput<S> = {
  [K in keyof S]: S[K] extends FieldDef ? FieldInput<S[K]> : never;
};
export type FieldInput<F extends FieldDef> = F extends { kind: infer K }
  ? K extends
        | 'text'
        | 'textarea'
        | 'richText'
        | 'url'
        | 'email'
        | 'password'
        | 'slug'
    ? string
    : K extends 'decimal' | 'integer' | 'float'
      ? number
      : K extends 'boolean'
        ? boolean
        : K extends 'select'
          ? F extends { options: { options: readonly (infer T)[] } }
            ? T
            : never
          : K extends 'multiSelect'
            ? F extends { options: { options: readonly (infer T)[] } }
              ? T[]
              : never
            : K extends 'datetime' | 'date' | 'time'
              ? string
              : K extends 'json'
                ? unknown
                : K extends 'relation'
                  ? F extends { options: { many: true } }
                    ? string[]
                    : string
                  : K extends 'image' | 'file'
                    ? F extends { options: { many?: true } }
                      ? string[]
                      : string
                    : K extends 'embedded'
                      ? F extends { options: { many?: true; schema: infer S } }
                        ? EmbeddedInput<S>[]
                        : F extends { options: { schema: infer S } }
                          ? EmbeddedInput<S>
                          : never
                      : never
  : never;

/** True when a field may be omitted from a create payload. */
export type IsOptionalField<F extends FieldDef> = F extends {
  options: { required: false };
}
  ? true
  : F extends { options: { nullable: true } }
    ? true
    : F extends { kind: 'slug'; options: { from: string } }
      ? true
      : false;

/** Required + optional fields split for a create operation. */
export type CreateInput<F extends FieldMap> = {
  [K in keyof F as IsOptionalField<F[K]> extends true ? never : K]: FieldInput<
    F[K]
  >;
} & {
  [K in keyof F as IsOptionalField<F[K]> extends true ? K : never]?: FieldInput<
    F[K]
  >;
};

/** Every field optional — PATCH semantics. */
export type UpdateInput<F extends FieldMap> = {
  [K in keyof F]?: FieldInput<F[K]>;
};

/* ─────────────────────────── Model definition ─────────────────────────── */

export interface ModelDefinition<
  N extends string = string,
  F extends FieldMap = FieldMap,
> {
  readonly name: N;
  /** Derived collection name, e.g. `Post` → `posts`. */
  readonly collection: string;
  readonly fields: F;
  readonly options: ModelOptions;
}

export function defineModel<N extends string, F extends FieldMap>(
  name: N,
  fields: F,
  options: ModelOptions = {},
): ModelDefinition<N, F> {
  return {
    name,
    collection: options.collection ?? pluralize(lowerFirst(name)),
    fields,
    options,
  };
}

/** Adds custom fields to a built-in model (e.g. the `User` model). */
export function extendModel<N extends string, F extends FieldMap>(
  name: N,
  fields: F,
): { name: N; fields: F } {
  return { name, fields };
}

/* ─────────────────────────── Built-in User model ─────────────────────────── */

/** Fields Ship ships by default for the built-in `User` model. */
export const BUILTIN_USER_FIELDS = {
  email: field.email({ required: true, unique: true }),
  password: field.password({ required: true }),
  role: field.text({ default: 'viewer' }),
  firstName: field.text({ nullable: true }),
  lastName: field.text({ nullable: true }),
  avatar: field.image({ nullable: true }),
  emailVerifiedAt: field.datetime({ nullable: true }),
  lastLoginAt: field.datetime({ nullable: true }),
} satisfies FieldMap;

/* ─────────────────────────── Built-in Media model ─────────────────────────── */

/**
 * Fields for Ship's built-in `Media` collection — the default asset library
 * every CMS ships (Payload's `media`). Image/file uploads flow through
 * `@ship/storage`, which optimizes them (WebP, resized variants) and writes
 * the result into a `Media` record.
 */
export const BUILTIN_MEDIA_FIELDS = {
  filename: field.text({ required: true }),
  alt: field.text({ nullable: true }),
  caption: field.text({ nullable: true }),
  mimeType: field.text({ required: true }),
  size: field.integer({ min: 0 }),
  width: field.integer({ min: 0, nullable: true }),
  height: field.integer({ min: 0, nullable: true }),
  key: field.text({ nullable: true }),
  url: field.url({ nullable: true }),
  storage: field.text({ default: 'local' }),
  sizes: field.json({ nullable: true }),
} satisfies FieldMap;

/**
 * The default `Media` model, ready to drop into `defineConfig({ models: [Media, ...] })`.
 * Override any option (permissions, cache, admin) by passing `overrides`.
 */
export function defineMediaModel(
  overrides: ModelOptions = {},
): ModelDefinition<'Media', typeof BUILTIN_MEDIA_FIELDS> {
  return defineModel('Media', BUILTIN_MEDIA_FIELDS, {
    collection: 'media',
    cache: { ttl: 3600, tags: ['media'] },
    permissions: {
      list: 'authenticated',
      read: 'public',
      create: 'role:editor',
      update: 'role:editor',
      delete: 'role:admin',
    },
    admin: {
      group: 'Media',
      listFields: ['filename', 'mimeType', 'size', 'width', 'height'],
      defaultSort: { field: 'createdAt', order: 'desc' },
    },
    ...overrides,
  });
}
