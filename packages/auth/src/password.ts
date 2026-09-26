/**
 * Password hashing — thin wrapper over bcryptjs with a stable, promisified
 * API. Uses bcrypt's adaptive cost to keep credentials slow to brute-force.
 */

import bcrypt from 'bcryptjs';

/**
 * Hash a plaintext password with a bcrypt salt.
 *
 * @param password Plaintext password to hash.
 * @param rounds    bcrypt cost factor. Higher is slower but stronger.
 * @returns A bcrypt hash string safe for storage.
 */
export async function hashPassword(
  password: string,
  rounds = 10,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 *
 * @param password Plaintext password to check.
 * @param hash     Stored bcrypt hash.
 * @returns `true` when the password matches the hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
