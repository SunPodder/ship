/**
 * Environment validation — `defineEnv()` builds a typed, Zod-validated env
 * accessor. `parse()` throws a `ShipError` with a `fields` map of per-variable
 * messages when validation fails.
 */

import type { z } from 'zod';
import { ShipError } from './errors';

export type EnvOutput<S extends Record<string, z.ZodType>> = {
  [K in keyof S]: z.output<S[K]>;
};

export interface EnvDefinition<S extends Record<string, z.ZodType>> {
  schema: S;
  parse: (env: Record<string, string | undefined>) => EnvOutput<S>;
}

export function defineEnv<S extends Record<string, z.ZodType>>(
  schema: S,
): EnvDefinition<S> {
  return {
    schema,
    parse(env) {
      const parsed: Record<string, unknown> = {};
      const errors: Record<string, string[]> = {};

      for (const key of Object.keys(schema) as (keyof S & string)[]) {
        const result = schema[key].safeParse(env[key]);
        if (result.success) {
          parsed[key] = result.data;
        } else {
          errors[key] = result.error.issues.map((issue) => issue.message);
        }
      }

      if (Object.keys(errors).length > 0) {
        throw new ShipError('ENV_VALIDATION_ERROR', 'Invalid environment variables', {
          fields: errors,
        });
      }

      return parsed as EnvOutput<S>;
    },
  };
}

/** Renders a ShipError env failure as the documented CLI block. */
export function formatEnvError(err: ShipError): string {
  const lines = ['❌ Invalid environment variables:'];
  for (const [key, messages] of Object.entries(err.fields ?? {})) {
    lines.push(`  ${key}: ${messages[0]}`);
  }
  return lines.join('\n');
}
