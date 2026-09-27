/**
 * Ship API boot entry.
 *
 * Loads the project-root `.env`, connects to MongoDB, builds the app, and
 * serves it with Bun. This file is only ever executed, never imported.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';

import config from '../../../ship.config';
import { createApp } from './app';

// The API runs with cwd = apps/api under Turbo; load the project-root .env.
const rootEnv = join(process.cwd(), '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#')) continue;
    const eq = entry.indexOf('=');
    if (eq === -1) continue;
    const key = entry.slice(0, eq).trim();
    const value = entry.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const port = Number(process.env.PORT ?? 3001);
const uri = process.env.MONGODB_URI;

if (uri) {
  await mongoose.connect(uri);
  console.log('MongoDB connected');
} else {
  console.warn('MONGODB_URI not set — set it in .env (see .env.example).');
}

Bun.serve({
  port,
  fetch: createApp(config).fetch,
});

console.log(`Ship API ready at http://localhost:${port}/api`);
