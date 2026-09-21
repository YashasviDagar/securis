import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/**
 * Securis - Password hashing and policy
 *
 * SECURITY-CRITICAL MODULE. Passwords are never stored, logged or transmitted
 * in plaintext. This module is the single place where credentials are hashed
 * and verified, so the whole platform shares one hardened configuration.
 *
 * Algorithm choice: Argon2id, the current OWASP-recommended password hashing
 * function. It is memory-hard (resistant to GPU/ASIC cracking) and combines the
 * side-channel resistance of Argon2i with the brute-force resistance of
 * Argon2d.
 *
 * Parameters (OWASP baseline, tuned for a server-side login):
 *   memoryCost : 19456 KiB (~19 MiB)
 *   timeCost   : 2 iterations
 *   parallelism: 1 lane
 * The parameters are embedded in the resulting hash string, so they can be
 * raised later without invalidating existing hashes.
 *
 * Connection: used by database/seed.ts (Phase 2) and the authentication service
 * (Phase 3). Native binding provided by @node-rs/argon2.
 */

/**
 * Argon2id algorithm id (2). Declared as a typed constant because
 * @node-rs/argon2 exposes `Algorithm` as an ambient const enum, which cannot be
 * accessed as a value under TypeScript's `isolatedModules` mode.
 */
const ARGON2ID = 2 as Algorithm;

/** Argon2id tuning parameters shared by hashing and verification. */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Password policy enforced whenever a password is created or changed. */
export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
} as const;

export interface PasswordPolicyResult {
  ok: boolean;
  /** Human-readable reasons the password was rejected (empty when ok). */
  errors: string[];
}

/**
 * Validate a plaintext password against the policy. Returns every violation so
 * the UI can show all requirements at once. The value itself is never logged.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Must be at least ${PASSWORD_POLICY.minLength} characters long.`);
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Must be at most ${PASSWORD_POLICY.maxLength} characters long.`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Must contain an uppercase letter.");
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Must contain a lowercase letter.");
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Must contain a number.");
  }
  if (PASSWORD_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Must contain a symbol.");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Hash a plaintext password with Argon2id.
 * The returned string is safe to persist; the plaintext is discarded.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored Argon2id hash.
 * Returns false (never throws) on malformed hashes so callers cannot
 * distinguish "wrong password" from "corrupt record" via error behaviour.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
