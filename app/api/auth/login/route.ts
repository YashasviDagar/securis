import { loginSchema } from "@/lib/validation/auth";
import { authenticate } from "@/server/services/auth-service";
import { sessionCookieOptions } from "@/auth/session";
import { SESSION_TTL_MINUTES } from "@/auth/constants";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * POST /api/auth/login
 *
 * Authenticates a user and, on success, issues an HttpOnly session cookie.
 *
 * Security:
 *   - Same-origin enforced (lightweight CSRF protection).
 *   - Input validated with Zod before any business logic.
 *   - All credential failures return the same generic message + 401.
 *   - Rate limiting returns 429.
 *   - Unexpected errors are logged server-side and never leaked to the client.
 *
 * Connection: server/services/auth-service.ts -> Prisma + Argon2id + audit.
 */

// Route handlers that touch the database and native crypto must run on Node.
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Request blocked.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid input.", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const context = {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  };

  try {
    const result = await authenticate(parsed.data, context);

    if (!result.ok) {
      const status = result.reason === "RATE_LIMITED" ? 429 : 401;
      return jsonError(result.message, status);
    }

    const response = jsonOk({
      user: result.session.user,
      expiresAt: result.session.expiresAt,
    });

    // Issue the session cookie. maxAge mirrors the absolute session TTL.
    response.cookies.set({
      ...sessionCookieOptions(SESSION_TTL_MINUTES * 60),
      value: result.token,
    });

    return response;
  } catch (error) {
    console.error("[Securis] login error:", describeError(error));
    return jsonError("An unexpected error occurred. Please try again.", 500);
  }
}
