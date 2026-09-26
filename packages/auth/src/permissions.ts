/**
 * Permission evaluation — pure predicates over `FieldPermission` rules from
 * `@ship/core`. Every evaluator is a pure function: it never throws and never
 * performs I/O, so it can be applied uniformly across CRUD operations.
 */

import type { FieldPermission } from '@ship/core';

/**
 * Role ordering, highest privilege first. `roleAllows` treats a lower index
 * as "at least as privileged as" a higher one.
 */
export const ROLE_HIERARCHY = [
  'superadmin',
  'admin',
  'editor',
  'moderator',
  'viewer',
  'authenticated',
  'public',
] as const;

const ROLE_LIST: readonly string[] = ROLE_HIERARCHY;

/**
 * Whether a user's role satisfies a required role, using the role hierarchy.
 *
 * @param requiredRole Role a rule demands.
 * @param userRole     Role the user actually holds.
 * @returns `true` when `userRole` is at least as privileged as `requiredRole`.
 *          Unknown role names never match.
 */
export function roleAllows(requiredRole: string, userRole: string): boolean {
  const requiredIndex = ROLE_LIST.indexOf(requiredRole);
  const userIndex = ROLE_LIST.indexOf(userRole);
  if (requiredIndex === -1 || userIndex === -1) return false;
  return userIndex <= requiredIndex;
}

/** Context available when evaluating a permission rule. */
export interface PermissionContext {
  /** Whether the request carries a valid authenticated identity. */
  authenticated: boolean;
  /** The authenticated user's id, when available. */
  userId?: string;
  /** The authenticated user's role, when available. */
  role?: string;
  /** The id of the user who owns the record being accessed, when applicable. */
  recordUserId?: string;
}

/**
 * Evaluate a single `FieldPermission` rule against a context. Pure — never
 * throws. Arrays use OR semantics: any matching element passes.
 */
export function evaluatePermission(
  permission: FieldPermission,
  ctx: PermissionContext,
): boolean {
  if (Array.isArray(permission)) {
    return permission.some((entry) => evaluatePermission(entry, ctx));
  }

  switch (permission) {
    case 'public':
      return true;
    case 'none':
      return false;
    case 'authenticated':
      return ctx.authenticated;
    case 'self':
      return ctx.authenticated && ctx.userId === ctx.recordUserId;
    default:
      if (permission.startsWith('role:')) {
        return (
          ctx.authenticated && roleAllows(permission.slice('role:'.length), ctx.role ?? 'viewer')
        );
      }
      return false;
  }
}

/**
 * Evaluate a field's read/write rule for a given action. A field without an
 * explicit rule for the action defaults to allowed (`true`).
 */
export function evaluateFieldPermission(
  rule: { read?: FieldPermission; write?: FieldPermission },
  action: 'read' | 'write',
  ctx: PermissionContext,
): boolean {
  const permission = rule[action];
  return permission === undefined ? true : evaluatePermission(permission, ctx);
}
