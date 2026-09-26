/**
 * JWT signing and verification — thin wrapper over `jose` for HS256-signed
 * access and refresh tokens. Secrets are passed as strings and encoded to
 * `Uint8Array` for the underlying WebCrypto HMAC key.
 */

import { SignJWT, jwtVerify } from 'jose';

/**
 * Sign an arbitrary payload into a compact HS256 JWT.
 *
 * @param payload    Claims to embed in the token.
 * @param secret     Shared HMAC secret.
 * @param ttlSeconds Lifetime of the token, in seconds from now.
 * @returns A signed, compact JWT string.
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(new TextEncoder().encode(secret));
}

/**
 * Verify a compact HS256 JWT and return its decoded payload.
 *
 * Throws on invalid signatures, malformed tokens, or expired tokens.
 *
 * @param token  Compact JWT string to verify.
 * @param secret Shared HMAC secret used to sign the token.
 * @returns The token's decoded payload, cast to `T`.
 */
export async function verifyJwt<T = Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as T;
}

/**
 * Sign a short-lived access token identifying a user.
 *
 * @param user       User whose `id` becomes the JWT `sub` claim.
 * @param secret     Shared HMAC secret.
 * @param ttlSeconds Lifetime in seconds. Defaults to 15 minutes.
 */
export async function signAccessToken(
  user: { id: string },
  secret: string,
  ttlSeconds = 900,
): Promise<string> {
  return signJwt({ sub: user.id }, secret, ttlSeconds);
}

/**
 * Sign a long-lived refresh token identifying a user.
 *
 * @param user       User whose `id` becomes the JWT `sub` claim.
 * @param secret     Shared HMAC secret.
 * @param ttlSeconds Lifetime in seconds. Defaults to 30 days.
 */
export async function signRefreshToken(
  user: { id: string },
  secret: string,
  ttlSeconds = 2592000,
): Promise<string> {
  return signJwt({ sub: user.id }, secret, ttlSeconds);
}

/**
 * Verify an access token and return the user id it identifies.
 *
 * @param token  Compact JWT string to verify.
 * @param secret Shared HMAC secret used to sign the token.
 * @returns The identified user id.
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<{ id: string }> {
  const payload = await verifyJwt<{ sub: string }>(token, secret);
  return { id: payload.sub };
}
