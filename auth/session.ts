import type { User } from "@prisma/client";
import { prisma } from "@/database/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_LAST_SEEN_THROTTLE_MS,
  SESSION_TTL_MS,
} from "./constants";
import { generateSessionToken, hashSessionToken } from "./token";
import type { AuthSession, SessionUser } from "@/types/auth";

/**
 * Securis - Session management
 *
 * Creates, validates and revokes database-backed sessions.
 *
 * Security properties:
 *   - The browser holds an opaque random token in an HttpOnly cookie.
 *   - The database stores only the SHA-256 hash of that token.
 *   - Sessions have an absolute expiry and can be revoked individually.
 *   - A disabled account's sessions stop working immediately.
 *
 * Connection: database/client.ts (Prisma) -> LoginSession + User tables.
 */

/** Metadata about the request that created or is using a session. */
export interface SessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Map a Prisma user row to the safe, client-facing session user. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Create a new session for a user.
 * Returns the raw token (to be set as a cookie) and the safe session object.
 */
export async function createSession(
  userId: string,
  context: SessionContext = {},
): Promise<{ token: string; session: AuthSession }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const record = await prisma.loginSession.create({
    data: {
      userId,
      tokenHash,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    },
    include: { user: true },
  });

  return {
    token,
    session: {
      id: record.id,
      user: toSessionUser(record.user),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
    },
  };
}

/**
 * Validate a raw session token.
 *
 * Returns null when the token is unknown, revoked, expired or belongs to a
 * disabled account. Expired and revoked sessions are cleaned up so they cannot
 * be reused, and expiry is recorded in the audit trail.
 */
export async function validateSessionToken(
  token: string,
): Promise<AuthSession | null> {
  const tokenHash = hashSessionToken(token);

  const record = await prisma.loginSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return null;

  const now = new Date();

  // Explicitly revoked sessions are rejected.
  if (record.revokedAt) return null;

  // Expired sessions are deleted and recorded once.
  if (record.expiresAt.getTime() <= now.getTime()) {
    await prisma.loginSession.delete({ where: { id: record.id } }).catch(() => {});
    await prisma.auditLog
      .create({
        data: {
          actorId: record.userId,
          actorEmail: record.user.email,
          action: "SESSION_EXPIRED",
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
          metadata: { reason: "ttl_elapsed", sessionId: record.id },
        },
      })
      .catch(() => {});
    return null;
  }

  // A disabled account must lose access immediately, even with a valid session.
  if (!record.user.isActive) {
    await prisma.loginSession
      .update({ where: { id: record.id }, data: { revokedAt: now } })
      .catch(() => {});
    return null;
  }

  // Refresh lastSeenAt, throttled to avoid a write on every request.
  if (now.getTime() - record.lastSeenAt.getTime() > SESSION_LAST_SEEN_THROTTLE_MS) {
    await prisma.loginSession
      .update({ where: { id: record.id }, data: { lastSeenAt: now } })
      .catch(() => {});
  }

  return {
    id: record.id,
    user: toSessionUser(record.user),
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
  };
}

/** Revoke a session by id (logout). Returns true if a session was revoked. */
export async function revokeSessionById(sessionId: string): Promise<boolean> {
  const result = await prisma.loginSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/** Revoke every active session for a user (used when disabling or resetting). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.loginSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Should the session cookie carry the `Secure` flag?
 *
 * Deriving this from the configured APP_URL scheme (rather than NODE_ENV alone)
 * is important: the Docker Compose workflow serves the app over plain HTTP on
 * localhost while running in production mode. A `Secure` cookie would be
 * rejected by the browser there and logins would silently fail.
 *
 * Rules:
 *   - APP_URL set to https://...  -> Secure (required in production).
 *   - APP_URL set to http://...   -> not Secure (local / self-hosted HTTP).
 *   - APP_URL unset               -> Secure when NODE_ENV is production (safe
 *                                    default for real deployments).
 */
function shouldUseSecureCookies(): boolean {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

/**
 * Cookie attributes for the session cookie.
 *
 * `httpOnly` blocks JavaScript access (XSS token theft), `sameSite: "lax"`
 * blocks cross-site POSTs while keeping normal navigation working, and `secure`
 * is enabled automatically for HTTPS deployments.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
