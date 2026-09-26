/**
 * FieldDef → Mongoose Schema builder.
 *
 * Translates the `@ship/core` field DSL into a Mongoose `Schema` so the code
 * generator can compile a `ModelDefinition` into a runtime model. No database
 * connection is required: the builder is pure.
 */

import {
  Schema,
  SchemaTypes,
  type IndexDefinition,
  type IndexDirection,
  type SchemaDefinitionProperty,
} from 'mongoose';
import type { FieldDef, FieldMap } from '@ship/core';

/* ─────────────────────────── Build options ─────────────────────────── */

export interface SchemaBuildOptions {
  indexes?: Array<{
    fields: string[];
    unique?: boolean;
    type?: 'text' | '2dsphere' | 'geo2d' | 'hashed' | 'asc' | 'desc' | 'normal';
    name?: string;
  }>;
  softDelete?: boolean;
  timestamps?: boolean;
}

type IndexType = NonNullable<SchemaBuildOptions['indexes']>[number]['type'];

/* ─────────────────────────── Helpers ─────────────────────────── */

/**
 * Resolve a field's `required` flag. A nullable field is never required, even
 * when `required` is explicitly set.
 */
function resolveRequired(options: {
  required?: boolean;
  nullable?: boolean;
}): boolean {
  if (options.nullable === true) return false;
  return options.required === true;
}

/** Map a schema index `type` to the value Mongoose expects per field. */
function indexValue(type?: IndexType): IndexDirection {
  switch (type) {
    case 'desc':
      return -1;
    case 'asc':
    case 'normal':
    case undefined:
      return 1;
    case 'geo2d':
      return '2d';
    default:
      return type;
  }
}

/* ─────────────────────────── Path builders ─────────────────────────── */

function stringPath(
  options: { required?: boolean; nullable?: boolean },
  extras: {
    minlength?: number;
    maxlength?: number;
    unique?: boolean;
    default?: string;
    lowercase?: boolean;
  } = {},
): SchemaDefinitionProperty {
  return {
    type: String,
    required: resolveRequired(options),
    ...(extras.minlength !== undefined ? { minlength: extras.minlength } : {}),
    ...(extras.maxlength !== undefined ? { maxlength: extras.maxlength } : {}),
    ...(extras.unique !== undefined ? { unique: extras.unique } : {}),
    ...(extras.default !== undefined ? { default: extras.default } : {}),
    ...(extras.lowercase !== undefined ? { lowercase: extras.lowercase } : {}),
  };
}

function buildPath(
  def: FieldDef,
  options: SchemaBuildOptions,
): SchemaDefinitionProperty {
  switch (def.kind) {
    case 'text':
      return stringPath(def.options, {
        minlength: def.options.minLength,
        maxlength: def.options.maxLength,
        unique: def.options.unique,
        default: def.options.default,
      });

    case 'textarea':
      return stringPath(def.options, {
        minlength: def.options.minLength,
        maxlength: def.options.maxLength,
        default: def.options.default,
      });

    case 'richText':
      return stringPath(def.options, { default: def.options.default });

    case 'url':
      return stringPath(def.options, {
        unique: def.options.unique,
        default: def.options.default,
      });

    case 'email':
      return stringPath(def.options, {
        unique: def.options.unique,
        default: def.options.default,
      });

    case 'password':
      return stringPath(def.options, { minlength: def.options.minLength });

    case 'slug':
      // Slug has no required/nullable options; a slug is never required.
      return stringPath({}, {
        unique: def.options.unique,
        lowercase: true,
      });

    case 'decimal':
      return {
        type: SchemaTypes.Decimal128,
        required: resolveRequired(def.options),
        ...(def.options.min !== undefined ? { min: def.options.min } : {}),
        ...(def.options.max !== undefined ? { max: def.options.max } : {}),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'integer':
      return {
        type: Number,
        required: resolveRequired(def.options),
        ...(def.options.min !== undefined ? { min: def.options.min } : {}),
        ...(def.options.max !== undefined ? { max: def.options.max } : {}),
        ...(def.options.unique !== undefined ? { unique: def.options.unique } : {}),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'float':
      return {
        type: Number,
        required: resolveRequired(def.options),
        ...(def.options.min !== undefined ? { min: def.options.min } : {}),
        ...(def.options.max !== undefined ? { max: def.options.max } : {}),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'boolean':
      return {
        type: Boolean,
        required: resolveRequired(def.options),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'select':
      return {
        type: String,
        enum: [...def.options.options],
        required: resolveRequired(def.options),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'multiSelect':
      return {
        type: [String],
        enum: [...def.options.options],
        required: resolveRequired(def.options),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'datetime':
    case 'date':
    case 'time':
      return {
        type: Date,
        required: resolveRequired(def.options),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'json':
      return {
        type: SchemaTypes.Mixed,
        required: resolveRequired(def.options),
        ...(def.options.default !== undefined ? { default: def.options.default } : {}),
      };

    case 'relation': {
      const opts = def.options;
      if (opts.many) {
        return { type: [SchemaTypes.ObjectId], ref: opts.model };
      }
      return {
        type: SchemaTypes.ObjectId,
        ref: opts.model,
        required: resolveRequired(opts),
      };
    }

    case 'embedded': {
      const nested = buildMongooseSchema(def.options.schema, options);
      return def.options.many ? [nested] : nested;
    }

    case 'image':
      return {
        type: def.options.many ? [String] : String,
        required: resolveRequired(def.options),
      };

    case 'file':
      return { type: String, required: resolveRequired(def.options) };
  }
}

/* ─────────────────────────── Builder ─────────────────────────── */

export function buildMongooseSchema(
  fields: FieldMap,
  options: SchemaBuildOptions = {},
): Schema {
  const definition: Record<string, SchemaDefinitionProperty> = {};

  for (const [name, def] of Object.entries(fields)) {
    definition[name] = buildPath(def, options);
  }

  if (options.softDelete) {
    definition.deletedAt = { type: Date, default: null };
  }

  const schema = new Schema(definition);

  if (options.timestamps !== false) {
    schema.set('timestamps', true);
  }

  for (const index of options.indexes ?? []) {
    const value = indexValue(index.type);
    const fieldsObj: IndexDefinition = {};
    for (const fieldName of index.fields) {
      fieldsObj[fieldName] = value;
    }
    const indexOptions: { unique?: boolean; name?: string } = {};
    if (index.unique !== undefined) indexOptions.unique = index.unique;
    if (index.name !== undefined) indexOptions.name = index.name;
    schema.index(fieldsObj, indexOptions);
  }

  return schema;
}
