/**
 * GraphQL schema builder.
 *
 * Generates a GraphQLSchema from Ship model definitions, wiring the generated
 * Query/Mutation fields to a service-layer resolver object.
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  GraphQLScalarType,
  Kind,
  valueFromASTUntyped,
  type GraphQLSchema,
} from 'graphql';
import { lowerFirst, pluralize, type FieldMap } from '@ship/core';
import { buildTypeDefs } from './sdl';

/** CRUD operations the generated schema delegates to. */
export interface ServiceResolvers {
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

type FieldResolver = (
  source: unknown,
  args: Record<string, unknown>,
  context: unknown,
  info: unknown,
) => unknown;

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value) => value as string,
  parseValue: (value) => value as string,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : null),
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => valueFromASTUntyped(ast),
});

/** Build an executable GraphQL schema for the given models and resolvers. */
export function buildGraphQLSchema(
  models: Array<{ name: string; fields: FieldMap }>,
  resolvers: ServiceResolvers,
): GraphQLSchema {
  const typeDefs = buildTypeDefs(models);

  const Query: Record<string, FieldResolver> = {};
  const Mutation: Record<string, FieldResolver> = {};

  for (const { name } of models) {
    const plural = pluralize(lowerFirst(name));
    const single = lowerFirst(name);

    Query[plural] = (_source, args) => resolvers.list(name, args);
    Query[single] = (_source, args) =>
      resolvers.get(name, (args as { id: string }).id);
    Mutation[`create${name}`] = (_source, args) =>
      resolvers.create(name, (args as { input: Record<string, unknown> }).input);
    Mutation[`update${name}`] = (_source, args) =>
      resolvers.update(
        name,
        (args as { id: string }).id,
        (args as { input: Record<string, unknown> }).input,
      );
    Mutation[`delete${name}`] = (_source, args) =>
      resolvers.remove(name, (args as { id: string }).id);
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers: { Query, Mutation, DateTime: DateTimeScalar, JSON: JSONScalar },
  });
}
