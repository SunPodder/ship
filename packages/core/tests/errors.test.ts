import { describe, expect, it } from 'bun:test';
import { ShipError, isShipError } from '../src/errors';

describe('ShipError', () => {
  it('sets name, code, message and default status 500', () => {
    const err = new ShipError('BOOM', 'Something broke');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ShipError');
    expect(err.code).toBe('BOOM');
    expect(err.message).toBe('Something broke');
    expect(err.status).toBe(500);
    expect(err.fields).toBeUndefined();
  });

  it('accepts a custom status and fields map', () => {
    const err = new ShipError('VALIDATION_ERROR', 'Validation failed', {
      status: 422,
      fields: { title: ['Title is required'] },
    });
    expect(err.status).toBe(422);
    expect(err.fields).toEqual({ title: ['Title is required'] });
  });

  it('serializes to the standard error envelope', () => {
    const err = new ShipError('FORBIDDEN', 'Insufficient permissions', { status: 403 });
    expect(err.toJSON()).toEqual({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
  });

  it('includes fields in JSON when present', () => {
    const err = new ShipError('E', 'm', { fields: { a: ['x'] } });
    expect(err.toJSON()).toEqual({ error: 'E', message: 'm', fields: { a: ['x'] } });
  });

  it('isShipError recognizes instances and structurally-compatible errors', () => {
    expect(isShipError(new ShipError('A', 'b'))).toBe(true);
    expect(isShipError(new Error('nope'))).toBe(false);
    expect(isShipError({ code: 'A', status: 400, message: 'b' })).toBe(false);
  });
});
