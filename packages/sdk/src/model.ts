/**
 * Ship SDK model API — typed CRUD over a single model's GraphQL operations.
 *
 * `createModelApi` derives the query/mutation documents from a model's name
 * and fields, targeting the backend's schema-first SDL:
 *
 *   query Post(...)        { posts(...)        { ... } }
 *   query Post($id: ID!)   { post(id: $id)     { ... } }
 *   mutation CreatePost    { createPost        { ... } }
 *   mutation UpdatePost    { updatePost        { ... } }
 *   mutation DeletePost    { deletePost            }
 */

import {
  lowerFirst,
  pluralize,
  type FieldMap,
  type FieldInput,
  type CreateInput,
  type UpdateInput,
} from '@ship/core';
import { createShipClient, type ShipClientOptions } from './client';

export type ModelRecord<F extends FieldMap> = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
} & {
  [K in keyof F]: FieldInput<F[K]> | null;
};

export interface ListArgs<F extends FieldMap> {
  where?: Partial<Record<keyof F, unknown>>;
  orderBy?: string;
  take?: number;
  skip?: number;
  q?: string;
}

export interface ModelApi<F extends FieldMap> {
  findMany(args?: ListArgs<F>): Promise<ModelRecord<F>[]>;
  findFirst(args?: ListArgs<F>): Promise<ModelRecord<F> | null>;
  findById(id: string): Promise<ModelRecord<F> | null>;
  findBySlug(slug: string): Promise<ModelRecord<F> | null>;
  create(input: CreateInput<F>): Promise<ModelRecord<F>>;
  update(id: string, input: UpdateInput<F>): Promise<ModelRecord<F> | null>;
  delete(id: string): Promise<boolean>;
}

export function createModelApi<F extends FieldMap>(
  model: { name: string; fields: F },
  options: ShipClientOptions,
): ModelApi<F> {
  const client = createShipClient(options);

  const Name = model.name;
  const single = lowerFirst(Name);
  const plural = pluralize(single);
  const selection = `id ${Object.keys(model.fields).join(' ')} createdAt updatedAt`;

  async function findMany(args: ListArgs<F> = {}): Promise<ModelRecord<F>[]> {
    const document = `query ${Name}($filter: JSON, $sort: String, $limit: Int, $offset: Int, $q: String) { ${plural}(filter: $filter, sort: $sort, limit: $limit, offset: $offset, q: $q) { ${selection} } }`;
    const data = await client.query<{ [key: string]: ModelRecord<F>[] }>(
      document,
      {
        filter: args.where,
        sort: args.orderBy,
        limit: args.take,
        offset: args.skip,
        q: args.q,
      },
    );
    return data[plural];
  }

  async function findFirst(args: ListArgs<F> = {}): Promise<ModelRecord<F> | null> {
    const rows = await findMany({ ...args, take: 1 });
    return rows[0] ?? null;
  }

  async function findById(id: string): Promise<ModelRecord<F> | null> {
    const document = `query ${Name}($id: ID!) { ${single}(id: $id) { ${selection} } }`;
    const data = await client.query<{ [key: string]: ModelRecord<F> | null }>(
      document,
      { id },
    );
    return data[single] ?? null;
  }

  async function create(input: CreateInput<F>): Promise<ModelRecord<F>> {
    const document = `mutation Create${Name}($input: Create${Name}Input!) { create${Name}(input: $input) { ${selection} } }`;
    const data = await client.mutate<{ [key: string]: ModelRecord<F> }>(document, {
      input,
    });
    return data[`create${Name}`];
  }

  async function update(
    id: string,
    input: UpdateInput<F>,
  ): Promise<ModelRecord<F> | null> {
    const document = `mutation Update${Name}($id: ID!, $input: Update${Name}Input!) { update${Name}(id: $id, input: $input) { ${selection} } }`;
    const data = await client.mutate<{ [key: string]: ModelRecord<F> | null }>(
      document,
      { id, input },
    );
    return data[`update${Name}`] ?? null;
  }

  async function deleteById(id: string): Promise<boolean> {
    const document = `mutation Delete${Name}($id: ID!) { delete${Name}(id: $id) }`;
    const data = await client.mutate<{ [key: string]: boolean }>(document, { id });
    return data[`delete${Name}`];
  }

  return {
    findMany,
    findFirst,
    findById,
    findBySlug: (slug: string) => findFirst({ where: { slug } as ListArgs<F>['where'] }),
    create,
    update,
    delete: deleteById,
  };
}
