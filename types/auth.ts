import type { Role } from "./security";

/**
 * Securis - Authentication types
 *
 * The minimal, safe representation of an authenticated user that is allowed to
 * cross the server/client boundary. Note what is NOT here: the password hash,
 * the session token and the token hash never leave the server.
 */

/** The authenticated principal attached to a validated session. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** A validated, non-expired session plus its user. */
export interface AuthSession {
  id: string;
  user: SessionUser;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Result of an authentication attempt. */
export type LoginResult =
  | { ok: true; session: AuthSession; token: string }
  | { ok: false; reason: LoginFailureReason; message: string };

/**
 * Why a login failed. Kept internal so the API can return a deliberately
 * generic message ("Invalid email or password") and avoid account enumeration,
 * while audit logs retain the precise reason.
 */
export type LoginFailureReason =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "RATE_LIMITED"
  | "INVALID_INPUT";
