import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_TOKEN_BYTES } from "./constants";

/**
 * Securis - Session token utilities
 *
 * A session token is a cryptographically random, opaque string. It is delivered
 * to the browser in an HttpOnly cookie and NEVER stored in the database.
 *
 * Instead, only its SHA-256 hash is persisted (LoginSession.tokenHash). This
 * means a database disclosure cannot be turned into a usable session, and
 * lookups remain a fast indexed equality check on the hash.
 *
 * SHA-256 (not Argon2) is correct here: the token already has 256 bits of
 * entropy, so there is nothing to brute force - we only need a fixed-length,
 * deterministic lookup key.
 */

/** Generate a new opaque session token (base64url, 32 random bytes). */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

/** Hash a session token for storage/lookup. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two token hashes. Used when a caller already has
 * a candidate hash; avoids leaking information through early-exit comparison.
 */
export function safeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
