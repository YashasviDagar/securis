import { getCurrentSession } from "@/auth/current-user";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/auth/session
 *
 * Returns the currently authenticated user, or 401 when there is no valid
 * session. The client uses this to hydrate auth state without ever seeing the
 * session token (which lives in an HttpOnly cookie).
 *
 * Connection: auth/current-user.ts -> auth/session.ts -> LoginSession table.
 */

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return jsonError("Not authenticated.", 401);
    }
    return jsonOk({
      user: session.user,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    });
  } catch (error) {
    console.error("[Securis] session lookup error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
