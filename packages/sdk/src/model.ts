/**
 * Ship SDK model API — typed CRUD over a single model's REST endpoints.
 *
 * `createModelApi` targets the generated REST routes:
 *
 *   GET    /api/<collection>?q=&sort=&limit=&offset=&filter=
 *   GET    /api/<collection>/:id
 *   POST   /api/<collection>
 *   PATCH  /api/<collection>/:id
 *   DELETE /api/<collection>/:id
 */

import {
  type CreateInput,
  type FieldInput,
  type FieldMap,
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
  model: { name: string; collection: string; fields: F },
  options: ShipClientOptions,
): ModelApi<F> {
  const client = createShipClient(options);
  const base = `/api/${model.collection}`;

  function listPath(args: ListArgs<F>): string {
    const params = new URLSearchParams();
    if (args.q) params.set('q', args.q);
    if (args.orderBy) params.set('sort', args.orderBy);
    if (args.take != null) params.set('limit', String(args.take));
    if (args.skip != null) params.set('offset', String(args.skip));
    if (args.where) params.set('filter', JSON.stringify(args.where));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  return {
    findMany: (args = {}) => client.get<ModelRecord<F>[]>(listPath(args)),

    findFirst: async (args = {}) => {
      const rows = await client.get<ModelRecord<F>[]>(
        listPath({ ...args, take: 1 }),
      );
      return rows[0] ?? null;
    },

    findById: async (id) => {
      const record = await client.get<ModelRecord<F> | null>(`${base}/${id}`);
      return record ?? null;
    },

    findBySlug: async (slug) => {
      const rows = await client.get<ModelRecord<F>[]>(
        listPath({ where: { slug } as ListArgs<F>['where'] }),
      );
      return rows[0] ?? null;
    },

    create: (input) => client.post<ModelRecord<F>>(base, input),

    update: (id, input) => client.patch<ModelRecord<F> | null>(`${base}/${id}`, input),

    delete: (id) => client.del<boolean>(`${base}/${id}`),
  };
}
