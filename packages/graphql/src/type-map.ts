/**
 * FieldDef → GraphQL type string mapping.
 *
 * Translates a single Ship field definition into the GraphQL type string used
 * by the SDL builder. Generated type names (enums, embedded documents) combine
 * the owning model name with the field's PascalCase name, so the field name is
 * supplied alongside the definition.
 */

import type { FieldDef } from '@ship/core';

/** PascalCase a camelCase identifier (e.g. `coverImage` → `CoverImage`). */
export function Pascal(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The GraphQL output (read) type for a field. */
export function outputType(
  def: FieldDef,
  modelName: string,
  fieldName: string,
): string {
  switch (def.kind) {
    case 'text':
    case 'textarea':
    case 'richText':
    case 'url':
    case 'email':
    case 'password':
    case 'slug':
      return 'String';
    case 'integer':
      return 'Int';
    case 'decimal':
    case 'float':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    case 'select':
      return `${modelName}${Pascal(fieldName)}Enum`;
    case 'multiSelect':
      return `[${modelName}${Pascal(fieldName)}Enum]`;
    case 'datetime':
    case 'date':
    case 'time':
      return 'DateTime';
    case 'json':
      return 'JSON';
    case 'relation':
      return def.options.many ? '[ID]' : 'ID';
    case 'embedded':
      return def.options.many
        ? `[${modelName}${Pascal(fieldName)}]`
        : `${modelName}${Pascal(fieldName)}`;
    case 'image':
      return def.options.many ? '[String]' : 'String';
    case 'file':
      return 'String';
  }
}

/** The GraphQL input (write) type for a field. */
export function inputType(
  def: FieldDef,
  modelName: string,
  fieldName: string,
): string {
  if (def.kind === 'embedded') {
    return def.options.many
      ? `[${modelName}${Pascal(fieldName)}Input]`
      : `${modelName}${Pascal(fieldName)}Input`;
  }
  return outputType(def, modelName, fieldName);
}
