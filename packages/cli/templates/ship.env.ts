import { defineEnv } from '@ship/core';
import { z } from 'zod';

export const env = defineEnv({
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
});
