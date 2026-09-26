/**
 * Auth routes — first-run admin bootstrap, login, and session lookup.
 * Tokens are returned to the client (stored in localStorage) and sent back via
 * `Authorization: Bearer <token>`.
 */
import { Hono } from 'hono';
import type { Model } from 'mongoose';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
} from '@ship/auth';

function toUser(doc: { _id: unknown; email: string; role?: string }) {
  return { id: String(doc._id), email: doc.email, role: doc.role ?? 'viewer' };
}

export function createAuthApp(userModel: Model<any>, secret: string): Hono {
  const app = new Hono();

  app.get('/auth/has-admin', async (c) => {
    const count = await userModel.countDocuments({});
    return c.json({ hasAdmin: count > 0 });
  });

  app.post('/auth/register-first-admin', async (c) => {
    const body = (await c.req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    const email = body?.email;
    const password = body?.password;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: 'A valid email and a password of at least 8 characters are required.' },
        422,
      );
    }

    if ((await userModel.countDocuments({})) > 0) {
      return c.json({ error: 'FORBIDDEN', message: 'An admin user already exists.' }, 403);
    }

    const user = await userModel.create({
      email,
      password: await hashPassword(password),
      role: 'superadmin',
    });
    const token = await signAccessToken({ id: String(user._id) }, secret);
    return c.json({ token, user: toUser(user) }, 201);
  });

  app.post('/auth/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    const email = body?.email;
    const password = body?.password;

    const user = typeof email === 'string' ? await userModel.findOne({ email }).lean() : null;
    if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.password))) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Invalid email or password.' }, 401);
    }

    const token = await signAccessToken({ id: String(user._id) }, secret);
    return c.json({ token, user: toUser(user) });
  });

  app.get('/auth/me', async (c) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Not authenticated.' }, 401);
    }

    let id: string;
    try {
      ({ id } = await verifyAccessToken(token, secret));
    } catch {
      return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' }, 401);
    }

    const user = await userModel.findById(id).lean();
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Not authenticated.' }, 401);
    }
    return c.json({ user: toUser(user) });
  });

  return app;
}
