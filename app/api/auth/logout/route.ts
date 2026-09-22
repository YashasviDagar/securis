import { NextResponse } from "next/server";
import { getCurrentSession } from "@/auth/current-user";
import { logout } from "@/server/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/auth/constants";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * POST /api/auth/logout
 *
 * Revokes the current session server-side and clears the session cookie.
 * Idempotent: logging out without a session still succeeds, so the client can
 * always reach a clean signed-out state.
 *
 * Connection: auth/current-user.ts (session lookup) ->
 * server/services/auth-service.ts (revoke + audit).
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Request blocked.", 403);
  }

  try {
    const session = await getCurrentSession();

    if (session) {
      await logout(session.id, session.user, {
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
    }

    const response = jsonOk({ signedOut: true });
    // Clear the cookie regardless of whether a session existed.
    response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[Securis] logout error:", describeError(error));
    // Still clear the cookie so the client is not stuck.
    const response = NextResponse.json(
      { ok: false, error: "An unexpected error occurred." },
      { status: 500 },
    );
    response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
    return response;
  }
}
