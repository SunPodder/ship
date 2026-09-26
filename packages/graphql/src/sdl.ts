/**
 * Ship models → GraphQL Schema Definition Language (SDL) string.
 */

import { lowerFirst, pluralize, type FieldDef, type FieldMap } from '@ship/core';
import { inputType, outputType, Pascal } from './type-map';

type ModelLike = { name: string; fields: FieldMap };

/** True when a field's options make it non-null (`!`) in the schema. */
function isRequired(def: FieldDef): boolean {
  const options = def.options;
  const required = 'required' in options && options.required === true;
  const nullable = 'nullable' in options && options.nullable === true;
  return required && !nullable;
}

function indent(lines: string[]): string {
  return lines.map((line) => `  ${line}`).join('\n');
}

function emitEnum(name: string, values: readonly string[]): string {
  const entries = values.map((value) => `  ${value}`).join('\n');
  return `enum ${name} {\n${entries}\n}`;
}

interface FieldEmission {
  output: string;
  createInput: string;
  updateInput: string;
  extras: string[];
}

function emitField(
  typeName: string,
  fieldName: string,
  def: FieldDef,
): FieldEmission {
  const output = outputType(def, typeName, fieldName);
  const input = inputType(def, typeName, fieldName);
  const required = isRequired(def) ? '!' : '';

  const extras: string[] = [];
  if (def.kind === 'select' || def.kind === 'multiSelect') {
    extras.push(
      emitEnum(`${typeName}${Pascal(fieldName)}Enum`, def.options.options),
    );
  }
  if (def.kind === 'embedded') {
    extras.push(
      ...emitEmbedded(`${typeName}${Pascal(fieldName)}`, def.options.schema),
    );
  }

  return {
    output: `${fieldName}: ${output}${required}`,
    createInput: `${fieldName}: ${input}${required}`,
    updateInput: `${fieldName}: ${input}`,
    extras,
  };
}

/** Emit the type + input for an embedded document, recursing into children. */
function emitEmbedded(typeName: string, fields: FieldMap): string[] {
  const output: string[] = [];
  const input: string[] = [];
  const extras: string[] = [];

  for (const [fieldName, def] of Object.entries(fields)) {
    const emission = emitField(typeName, fieldName, def);
    output.push(emission.output);
    input.push(emission.createInput);
    extras.push(...emission.extras);
  }

  return [
    `type ${typeName} {\n${indent(output)}\n}`,
    `input ${typeName}Input {\n${indent(input)}\n}`,
    ...extras,
  ];
}

/** Emit the type + create/update inputs for a top-level model. */
function emitModel(name: string, fields: FieldMap): string[] {
  const output: string[] = ['id: ID!'];
  const create: string[] = [];
  const update: string[] = [];
  const extras: string[] = [];

  for (const [fieldName, def] of Object.entries(fields)) {
    const emission = emitField(name, fieldName, def);
    output.push(emission.output);
    create.push(emission.createInput);
    update.push(emission.updateInput);
    extras.push(...emission.extras);
  }

  output.push('createdAt: DateTime', 'updatedAt: DateTime');

  return [
    `type ${name} {\n${indent(output)}\n}`,
    `input Create${name}Input {\n${indent(create)}\n}`,
    `input Update${name}Input {\n${indent(update)}\n}`,
    ...extras,
  ];
}

function emitQuery(models: ModelLike[]): string {
  const fields = models.flatMap((model) => {
    const plural = pluralize(lowerFirst(model.name));
    const single = lowerFirst(model.name);
    return [
      `  ${plural}(filter: JSON, sort: String, limit: Int, offset: Int, q: String): [${model.name}!]!`,
      `  ${single}(id: ID!): ${model.name}`,
    ];
  });
  return `type Query {\n${fields.join('\n')}\n}`;
}

function emitMutation(models: ModelLike[]): string {
  const fields = models.flatMap((model) => {
    const name = model.name;
    return [
      `  create${name}(input: Create${name}Input!): ${name}!`,
      `  update${name}(id: ID!, input: Update${name}Input!): ${name}`,
      `  delete${name}(id: ID!): Boolean!`,
    ];
  });
  return `type Mutation {\n${fields.join('\n')}\n}`;
}

/** Build a complete GraphQL SDL document for the given models. */
export function buildTypeDefs(models: ModelLike[]): string {
  const blocks: string[] = ['scalar DateTime', 'scalar JSON'];

  for (const model of models) {
    blocks.push(...emitModel(model.name, model.fields));
  }

  blocks.push(emitQuery(models), emitMutation(models));

  return blocks.join('\n\n');
}
