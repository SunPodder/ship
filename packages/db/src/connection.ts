/**
 * MongoDB connection manager.
 *
 * Wraps Mongoose's default connection behind a tiny typed API so the generated
 * server bootstraps with `connectDb({ uri })` and tears down with
 * `disconnectDb()`. No connection is opened until `connectDb` is called.
 */

import mongoose, { type ConnectOptions } from 'mongoose';

export interface DbConnectOptions {
  uri: string;
  readPreference?: string;
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
}

export async function connectDb(
  options: DbConnectOptions,
): Promise<typeof mongoose> {
  const { uri, ...connectOptions } = options;
  // `DbConnectOptions` is a narrow, user-facing subset of Mongoose's
  // `ConnectOptions`; `readPreference` is an intentionally loose string the
  // driver coerces to a `ReadPreferenceLike`. Cast through `unknown` rather
  // than surfacing the driver's full option surface.
  return mongoose.connect(uri, connectOptions as unknown as ConnectOptions);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
