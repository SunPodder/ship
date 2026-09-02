/**
 * ShipError — the single error type thrown by Ship services, handlers, and
 * adapters. It carries a machine-readable `code`, an HTTP `status`, and an
 * optional `fields` map of per-field validation messages.
 *
 * Usage:
 *   throw new ShipError('INSUFFICIENT_STOCK', 'Not enough stock available', {
 *     status: 400,
 *     fields: { quantity: ['Requested quantity exceeds available stock'] },
 *   })
 */

export interface ShipErrorOptions {
  /** HTTP status code. Defaults to 500. */
  status?: number;
  /** Per-field error messages, keyed by field name. */
  fields?: Record<string, string[]>;
  /** Underlying cause, forwarded to the native Error. */
  cause?: unknown;
}

export class ShipError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    { status = 500, fields, cause }: ShipErrorOptions = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ShipError';
    this.code = code;
    this.status = status;
    if (fields !== undefined) this.fields = fields;
  }

  /** Serializes to the standard Ship error envelope. */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }
}

/** True if the given value is a ShipError (safe across module instances). */
export function isShipError(value: unknown): value is ShipError {
  return (
    value instanceof ShipError ||
    (value instanceof Error &&
      typeof (value as ShipError).code === 'string' &&
      typeof (value as ShipError).status === 'number')
  );
}
