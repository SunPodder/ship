import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { defineEnv, formatEnvError } from '../src/env';
import { ShipError } from '../src/errors';

describe('defineEnv', () => {
  const envDef = defineEnv({
    MONGODB_URI: z.string().url(),
    JWT_SECRET: z.string().min(32),
    PORT: z.coerce.number().optional(),
  });

  it('parses a valid environment', () => {
    const parsed = envDef.parse({
      MONGODB_URI: 'mongodb://localhost:27017/app',
      JWT_SECRET: 'x'.repeat(32),
    });
    expect(parsed.MONGODB_URI).toBe('mongodb://localhost:27017/app');
    expect(parsed.JWT_SECRET).toBe('x'.repeat(32));
  });

  it('throws a ShipError with per-field messages on failure', () => {
    let caught: ShipError | null = null;
    try {
      envDef.parse({ MONGODB_URI: undefined, JWT_SECRET: 'short' });
    } catch (e) {
      caught = e as ShipError;
    }
    expect(caught).toBeInstanceOf(ShipError);
    expect(caught!.code).toBe('ENV_VALIDATION_ERROR');
    expect(caught!.fields).toHaveProperty('MONGODB_URI');
    expect(caught!.fields).toHaveProperty('JWT_SECRET');
  });

  it('treats a missing required variable as invalid', () => {
    const req = defineEnv({ SECRET: z.string() });
    expect(() => req.parse({})).toThrow(ShipError);
  });

  it('formats the error as the documented CLI block', () => {
    const err = new ShipError('ENV_VALIDATION_ERROR', 'Invalid environment variables', {
      fields: { MONGODB_URI: ['Required'], JWT_SECRET: ['String must contain at least 32 character(s)'] },
    });
    const text = formatEnvError(err);
    expect(text).toContain('MONGODB_URI: Required');
    expect(text).toContain('JWT_SECRET: String must contain at least 32 character(s)');
  });
});
