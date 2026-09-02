/**
 * Configuration DSL — `defineConfig()` and the `ShipConfig` shape documented
 * in `docs/config.md`. `defineConfig` is a typed identity helper so users get
 * autocomplete and validation at the call site without runtime magic.
 */

import type { ModelDefinition, ModelOptions } from './model';
import type { FieldMap } from './fields';

export interface DatabaseConfig {
  adapter?: string;
  uri?: string;
  options?: Record<string, unknown>;
  readPreference?: string;
  sync?: { autoSync?: boolean; background?: boolean };
}

export interface CacheConfig {
  adapter?: 'redis' | 'memory' | 'cloudflare-kv' | (string & {});
  url?: string;
  defaultTTL?: number;
  defaultStrategy?: string;
  prefix?: string;
  cluster?: boolean;
  l1?: { maxSize?: number; ttl?: number };
  warm?: { enabled?: boolean; queries?: unknown[] };
}

export interface JwtAuthConfig {
  secret?: string;
  accessTokenTTL?: string;
  refreshTokenTTL?: string;
  algorithm?: string;
}

export interface AuthConfig {
  adapter?: 'jwt' | 'session' | (string & {});
  jwt?: JwtAuthConfig;
  roles?: string[];
  defaultRole?: string;
  registration?: { enabled?: boolean; emailVerification?: boolean };
  oauth?: Record<string, { clientId?: string; clientSecret?: string }>;
  password?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireNumber?: boolean;
  };
  twoFactor?: { enabled?: boolean; required?: boolean };
  refreshTokenStore?: 'redis' | 'database';
  session?: Record<string, unknown>;
}

export interface StorageAdapterConfig {
  [key: string]: unknown;
}

export interface StorageConfig {
  default?: string;
  adapters?: Record<string, StorageAdapterConfig>;
  images?: {
    optimize?: boolean;
    quality?: number;
    formats?: string[];
    stripMetadata?: boolean;
    progressive?: boolean;
  };
}

export interface EmailConfig {
  adapter?: string;
  apiKey?: string;
  from?: string;
}

export interface SearchConfig {
  adapter?: string;
  url?: string;
  apiKey?: string;
}

export interface ApiConfig {
  prefix?: string;
  port?: number;
  cors?: { origin?: string | string[]; credentials?: boolean };
  rateLimit?: { windowMs?: number; max?: number };
  pagination?: { defaultLimit?: number; maxLimit?: number; style?: 'offset' | 'cursor' };
  openapi?: { enabled?: boolean; path?: string; title?: string; version?: string };
}

export interface AdminConfig {
  path?: string;
  title?: string;
  theme?: { primaryColor?: string; darkMode?: boolean };
  groups?: { name: string; models: string[] }[];
  cacheInspector?: boolean;
}

export interface ShipConfig {
  models: ModelDefinition[];
  database?: DatabaseConfig;
  cache?: CacheConfig;
  auth?: AuthConfig;
  storage?: StorageConfig;
  email?: EmailConfig;
  search?: SearchConfig;
  api?: ApiConfig;
  admin?: AdminConfig;
  globalHooks?: Record<string, (modelName: string, data: unknown, ctx: unknown) => unknown | Promise<unknown>>;
  plugins?: unknown[];
}

export interface DefineConfigInput extends Omit<ShipConfig, 'models'> {
  models?: ModelDefinition[];
}

/** Typed identity helper — returns the config unchanged with defaults applied. */
export function defineConfig(config: DefineConfigInput): ShipConfig {
  return { models: [], ...config };
}

// Re-export so `ship.config.ts` can `import { defineConfig, defineModel, field } from '@ship/core'`.
export type { ModelDefinition, ModelOptions, FieldMap };
