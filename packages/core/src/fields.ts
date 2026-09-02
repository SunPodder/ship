/**
 * Field DSL — the `field.*` factories used inside `defineModel()`.
 *
 * Each factory returns a `FieldDef` discriminated union on `kind`, with the
 * per-kind options in `options`. The definitions carry no field name: the name
 * is bound by `defineModel()` from the object key.
 */

import type { z } from 'zod';

/* ─────────────────────────── Option types ─────────────────────────── */

export interface TextOptions {
  required?: boolean;
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  searchable?: boolean;
  unique?: boolean;
  default?: string;
}

export interface TextareaOptions {
  required?: boolean;
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  default?: string;
}

export interface RichTextOptions {
  required?: boolean;
  nullable?: boolean;
  /** Storage/output format. Defaults to 'json' (Tiptap). */
  output?: 'json' | 'html' | 'markdown';
  default?: string;
}

export interface UrlOptions {
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: string;
}

export interface EmailOptions {
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: string;
}

export interface PasswordOptions {
  required?: boolean;
  minLength?: number;
}

export interface SlugOptions {
  /** Field to derive the slug from. When set, the slug is auto-generated. */
  from?: string;
  unique?: boolean;
  /** Allow manual override in the admin UI. */
  editable?: boolean;
}

export interface DecimalOptions {
  precision?: number;
  scale?: number;
  min?: number;
  max?: number;
  required?: boolean;
  nullable?: boolean;
  default?: number;
}

export interface IntegerOptions {
  min?: number;
  max?: number;
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: number;
}

export interface FloatOptions {
  min?: number;
  max?: number;
  required?: boolean;
  nullable?: boolean;
  default?: number;
}

export interface BooleanOptions {
  required?: boolean;
  default?: boolean;
}

export interface SelectOptions<T extends string = string> {
  options: readonly T[];
  default?: T;
  required?: boolean;
  nullable?: boolean;
}

export interface MultiSelectOptions<T extends string = string> {
  options: readonly T[];
  default?: readonly T[];
  required?: boolean;
}

export interface DateTimeOptions {
  nullable?: boolean;
  required?: boolean;
  default?: string | Date;
}

export interface DateOptions {
  nullable?: boolean;
  required?: boolean;
  default?: string | Date;
}

export interface TimeOptions {
  nullable?: boolean;
  required?: boolean;
  default?: string;
}

export interface JsonOptions {
  nullable?: boolean;
  required?: boolean;
  /** Optional Zod schema for validating the JSON value. */
  schema?: z.ZodType;
  default?: unknown;
}

export interface RelationOptions {
  /** Target model name (PascalCase), set from the first argument. */
  model?: string;
  /** Many-to-many when true; many-to-one when false (default). */
  many?: boolean;
  required?: boolean;
  /** Reverse one-to-many: the FK lives on the target model. */
  reverse?: boolean;
}

export interface EmbeddedOptions {
  /** Sub-document schema, expressed with the same `field.*` DSL. */
  schema: Record<string, FieldDef>;
  /** Array of embedded documents when true. */
  many?: boolean;
  required?: boolean;
  nullable?: boolean;
}

export interface ImageSizes {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ImageOptions {
  storage?: string;
  nullable?: boolean;
  required?: boolean;
  /** Max size as a human string, e.g. '5mb'. */
  maxSize?: string;
  /** Thumbnail variants generated on upload. */
  sizes?: Record<string, ImageSizes>;
  many?: boolean;
  maxFiles?: number;
  accept?: string[];
}

export interface FileOptions {
  storage?: string;
  nullable?: boolean;
  required?: boolean;
  accept?: string[];
  maxSize?: string;
}

/* ─────────────────────────── FieldDef union ─────────────────────────── */

export type FieldDef =
  | { kind: 'text'; options: TextOptions }
  | { kind: 'textarea'; options: TextareaOptions }
  | { kind: 'richText'; options: RichTextOptions }
  | { kind: 'url'; options: UrlOptions }
  | { kind: 'email'; options: EmailOptions }
  | { kind: 'password'; options: PasswordOptions }
  | { kind: 'slug'; options: SlugOptions }
  | { kind: 'decimal'; options: DecimalOptions }
  | { kind: 'integer'; options: IntegerOptions }
  | { kind: 'float'; options: FloatOptions }
  | { kind: 'boolean'; options: BooleanOptions }
  | { kind: 'select'; options: SelectOptions }
  | { kind: 'multiSelect'; options: MultiSelectOptions }
  | { kind: 'datetime'; options: DateTimeOptions }
  | { kind: 'date'; options: DateOptions }
  | { kind: 'time'; options: TimeOptions }
  | { kind: 'json'; options: JsonOptions }
  | { kind: 'relation'; options: RelationOptions }
  | { kind: 'embedded'; options: EmbeddedOptions }
  | { kind: 'image'; options: ImageOptions }
  | { kind: 'file'; options: FileOptions };

export type FieldKind = FieldDef['kind'];

export type FieldMap = Record<string, FieldDef>;

/* ─────────────────────────── Factories ─────────────────────────── */

export const field = {
  text: (options: TextOptions = {}): FieldDef => ({ kind: 'text', options }),

  textarea: (options: TextareaOptions = {}): FieldDef => ({
    kind: 'textarea',
    options,
  }),

  richText: (options: RichTextOptions = {}): FieldDef => ({
    kind: 'richText',
    options,
  }),

  url: (options: UrlOptions = {}): FieldDef => ({ kind: 'url', options }),

  email: (options: EmailOptions = {}): FieldDef => ({ kind: 'email', options }),

  password: (options: PasswordOptions = {}): FieldDef => ({
    kind: 'password',
    options,
  }),

  slug: (options: SlugOptions = {}): FieldDef => ({ kind: 'slug', options }),

  decimal: (options: DecimalOptions = {}): FieldDef => ({
    kind: 'decimal',
    options,
  }),

  integer: (options: IntegerOptions = {}): FieldDef => ({
    kind: 'integer',
    options,
  }),

  float: (options: FloatOptions = {}): FieldDef => ({ kind: 'float', options }),

  boolean: (options: BooleanOptions = {}): FieldDef => ({
    kind: 'boolean',
    options,
  }),

  select: <const T extends string>(
    options: readonly T[],
    opts: Omit<SelectOptions<T>, 'options'> = {},
  ): { kind: 'select'; options: SelectOptions<T> } => ({
    kind: 'select',
    options: { options, ...opts },
  }),

  multiSelect: <const T extends string>(
    options: readonly T[],
    opts: Omit<MultiSelectOptions<T>, 'options'> = {},
  ): { kind: 'multiSelect'; options: MultiSelectOptions<T> } => ({
    kind: 'multiSelect',
    options: { options, ...opts },
  }),

  datetime: (options: DateTimeOptions = {}): FieldDef => ({
    kind: 'datetime',
    options,
  }),

  date: (options: DateOptions = {}): FieldDef => ({ kind: 'date', options }),

  time: (options: TimeOptions = {}): FieldDef => ({ kind: 'time', options }),

  json: (options: JsonOptions = {}): FieldDef => ({ kind: 'json', options }),

  relation: (model: string, options: RelationOptions = {}): FieldDef => ({
    kind: 'relation',
    options: { ...options, model },
  }),

  embedded: (options: EmbeddedOptions): FieldDef => ({
    kind: 'embedded',
    options,
  }),

  image: (options: ImageOptions = {}): FieldDef => ({ kind: 'image', options }),

  file: (options: FileOptions = {}): FieldDef => ({ kind: 'file', options }),
} as const;
