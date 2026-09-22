import { prisma } from "@/database/client";
import { verifyPassword } from "@/security/password";
import { normaliseEmail } from "@/lib/validation/auth";
import { consumeRateLimit, resetRateLimit } from "@/server/http/rate-limit";
import { recordAudit } from "@/server/services/audit-service";
import { createSession, revokeSessionById } from "@/auth/session";
import type { SessionContext } from "@/auth/session";
import type { LoginResult } from "@/types/auth";

/**
 * Securis - Authentication service
 *
 * The single place where credentials are checked. Route handlers stay thin and
 * delegate here so the security logic is testable in isolation.
 *
 * Controls implemented:
 *   - Sliding-window rate limiting per source IP *and* per account.
 *   - Argon2id password verification.
 *   - Account-enumeration resistance: the same generic error is returned for an
 *     unknown email, a wrong password and a disabled account, and a dummy hash
 *     is verified when the account does not exist so response timing does not
 *     reveal whether the email is registered.
 *   - Disabled accounts cannot authenticate.
 *   - Every attempt is written to the audit trail.
 */

/** Login rate-limit configuration (see .env.example). */
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? "5");
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = Number(
  process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? "300",
);

/**
 * A valid Argon2id hash used purely to equalise timing when the supplied email
 * does not correspond to a user. It is not a secret and matches no account.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$dEo32sZothaLSGnL+v3nxg$zxVvRt77cvafAXD2dfunJwwKye4R/Wdn6El8cZtcrng";

/** Deliberately generic message returned for every credential failure. */
const GENERIC_FAILURE = "Invalid email or password.";

const ipKey = (ip: string) => `login:ip:${ip}`;
const accountKey = (email: string) => `login:account:${email}`;

/**
 * Attempt to authenticate a user.
 * @param input  Raw email/password from the request (validated by the caller).
 * @param context Request metadata (IP, user agent) for audit + rate limiting.
 */
export async function authenticate(
  input: { email: string; password: string },
  context: SessionContext = {},
): Promise<LoginResult> {
  const email = normaliseEmail(input.email);
  const ip = context.ipAddress ?? "unknown";

  // --- Rate limiting (IP then account) --------------------------------------
  const ipLimit = consumeRateLimit(
    ipKey(ip),
    LOGIN_RATE_LIMIT_MAX,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!ipLimit.allowed) {
    await recordAudit({
      actorEmail: email,
      action: "LOGIN_FAILED",
      ipAddress: ip,
      userAgent: context.userAgent ?? null,
      metadata: { reason: "rate_limited_ip", retryAfterSeconds: ipLimit.retryAfterSeconds },
    });
    return {
      ok: false,
      reason: "RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
    };
  }

  const accountLimit = consumeRateLimit(
    accountKey(email),
    LOGIN_RATE_LIMIT_MAX,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!accountLimit.allowed) {
    await recordAudit({
      actorEmail: email,
      action: "LOGIN_FAILED",
      ipAddress: ip,
      userAgent: context.userAgent ?? null,
      metadata: {
        reason: "rate_limited_account",
        retryAfterSeconds: accountLimit.retryAfterSeconds,
      },
    });
    return {
      ok: false,
      reason: "RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
    };
  }

  // --- Credential check -----------------------------------------------------
  const user = await prisma.user.findUnique({ where: { email } });

  // Always perform a hash verification so timing does not reveal existence.
  const passwordMatches = await verifyPassword(
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    input.password,
  );

  if (!user) {
    await recordAudit({
      actorEmail: email,
      action: "LOGIN_FAILED",
      ipAddress: ip,
      userAgent: context.userAgent ?? null,
      metadata: { reason: "unknown_account" },
    });
    return { ok: false, reason: "INVALID_CREDENTIALS", message: GENERIC_FAILURE };
  }

  if (!passwordMatches) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      ipAddress: ip,
      userAgent: context.userAgent ?? null,
      metadata: { reason: "invalid_password" },
    });
    return { ok: false, reason: "INVALID_CREDENTIALS", message: GENERIC_FAILURE };
  }

  if (!user.isActive) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      ipAddress: ip,
      userAgent: context.userAgent ?? null,
      metadata: { reason: "account_disabled" },
    });
    return { ok: false, reason: "ACCOUNT_DISABLED", message: GENERIC_FAILURE };
  }

  // --- Success --------------------------------------------------------------
  // Clear the failure counters so a legitimate user is not penalised later.
  resetRateLimit(ipKey(ip));
  resetRateLimit(accountKey(email));

  const { token, session } = await createSession(user.id, context);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "LOGIN_SUCCESS",
    ipAddress: ip,
    userAgent: context.userAgent ?? null,
    metadata: { role: user.role },
  });
  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "SESSION_CREATED",
    targetType: "LoginSession",
    targetId: session.id,
    ipAddress: ip,
    userAgent: context.userAgent ?? null,
    metadata: { expiresAt: session.expiresAt.toISOString() },
  });

  return { ok: true, session, token };
}

/**
 * Log out the current session: revoke it in the database and audit the action.
 */
export async function logout(
  sessionId: string,
  user: { id: string; email: string },
  context: SessionContext = {},
): Promise<void> {
  const revoked = await revokeSessionById(sessionId);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "LOGOUT",
    targetType: "LoginSession",
    targetId: sessionId,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
    metadata: { revoked },
  });
}
