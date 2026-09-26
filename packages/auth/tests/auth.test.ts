import { describe, expect, it } from 'bun:test';

import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  roleAllows,
  evaluatePermission,
  evaluateFieldPermission,
} from '../src';

const SECRET = 'test-secret';

describe('password', () => {
  it('round-trips a password through hash and verify', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password against a stored hash', async () => {
    const hash = await hashPassword('right-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('uses a configurable cost factor', async () => {
    const hash = await hashPassword('pw', 4);
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2')).toBe(true);
  });
});

describe('jwt', () => {
  it('round-trips a payload through signJwt and verifyJwt', async () => {
    const token = await signJwt({ sub: '1' }, SECRET, 60);
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe('1');
  });

  it('throws when verifying a tampered token', async () => {
    const token = await signJwt({ sub: '1' }, SECRET, 60);
    const tampered = token + 'x';
    await expect(verifyJwt(tampered, SECRET)).rejects.toThrow();
  });

  it('throws when verifying a token signed with a different secret', async () => {
    const token = await signJwt({ sub: '1' }, SECRET, 60);
    await expect(verifyJwt(token, 'other-secret')).rejects.toThrow();
  });

  it('throws when verifying an expired token', async () => {
    const token = await signJwt({ sub: '1' }, SECRET, -1);
    await expect(verifyJwt(token, SECRET)).rejects.toThrow();
  });

  it('round-trips access and refresh tokens to a user id', async () => {
    const access = await signAccessToken({ id: 'user-1' }, SECRET);
    const refresh = await signRefreshToken({ id: 'user-1' }, SECRET);
    expect(await verifyAccessToken(access, SECRET)).toEqual({ id: 'user-1' });
    expect((await verifyJwt<{ sub: string }>(refresh, SECRET)).sub).toBe('user-1');
  });
});

describe('roleAllows', () => {
  it('lets an equal or higher role satisfy the requirement', () => {
    expect(roleAllows('editor', 'editor')).toBe(true);
    expect(roleAllows('editor', 'admin')).toBe(true);
    expect(roleAllows('editor', 'superadmin')).toBe(true);
  });

  it('rejects a lower role', () => {
    expect(roleAllows('editor', 'viewer')).toBe(false);
    expect(roleAllows('admin', 'editor')).toBe(false);
  });

  it('rejects unknown role names', () => {
    expect(roleAllows('editor', 'wat')).toBe(false);
    expect(roleAllows('wat', 'admin')).toBe(false);
  });
});

describe('evaluatePermission', () => {
  it('treats public as always allowed', () => {
    expect(evaluatePermission('public', { authenticated: false })).toBe(true);
    expect(evaluatePermission('public', { authenticated: true })).toBe(true);
  });

  it('treats none as always denied', () => {
    expect(evaluatePermission('none', { authenticated: true })).toBe(false);
  });

  it('respects the authenticated flag for authenticated rules', () => {
    expect(evaluatePermission('authenticated', { authenticated: true })).toBe(true);
    expect(evaluatePermission('authenticated', { authenticated: false })).toBe(false);
  });

  it('allows self only when the authenticated user owns the record', () => {
    const ctx = { authenticated: true, userId: 'a', recordUserId: 'a' };
    expect(evaluatePermission('self', ctx)).toBe(true);
    expect(evaluatePermission('self', { ...ctx, recordUserId: 'b' })).toBe(false);
    expect(evaluatePermission('self', { authenticated: false, userId: 'a', recordUserId: 'a' })).toBe(false);
  });

  it('evaluates role rules against the hierarchy', () => {
    expect(evaluatePermission('role:editor', { authenticated: true, role: 'admin' })).toBe(true);
    expect(evaluatePermission('role:editor', { authenticated: true, role: 'viewer' })).toBe(false);
    expect(evaluatePermission('role:editor', { authenticated: false, role: 'admin' })).toBe(false);
  });

  it('applies OR semantics across an array of rules', () => {
    expect(evaluatePermission(['none', 'public'], { authenticated: false })).toBe(true);
    expect(evaluatePermission(['none', 'authenticated'], { authenticated: false })).toBe(false);
    expect(evaluatePermission(['role:editor', 'authenticated'], { authenticated: true, role: 'viewer' })).toBe(true);
  });

  it('rejects unknown rule strings', () => {
    expect(evaluatePermission('not-a-rule', { authenticated: true })).toBe(false);
  });
});

describe('evaluateFieldPermission', () => {
  it('defaults to allowed when the action rule is absent', () => {
    expect(evaluateFieldPermission({}, 'read', { authenticated: false })).toBe(true);
    expect(evaluateFieldPermission({ read: 'authenticated' }, 'write', { authenticated: false })).toBe(true);
  });

  it('evaluates the matching action rule', () => {
    const rule = { read: 'authenticated', write: 'self' };
    expect(evaluateFieldPermission(rule, 'read', { authenticated: false })).toBe(false);
    expect(evaluateFieldPermission(rule, 'read', { authenticated: true })).toBe(true);
    expect(evaluateFieldPermission(rule, 'write', { authenticated: true, userId: 'a', recordUserId: 'a' })).toBe(true);
    expect(evaluateFieldPermission(rule, 'write', { authenticated: true, userId: 'a', recordUserId: 'b' })).toBe(false);
  });
});
