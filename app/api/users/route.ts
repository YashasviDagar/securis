import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { createUserSchema, parseUserQuery } from "@/lib/validation/users";
import { createUser, listUsers } from "@/server/services/user-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/users
 *
 *   GET  - paginated user list (requires `users:read`).
 *   POST - create a user (requires `users:write`).
 *
 * Connection: lib/validation/users.ts -> server/services/user-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "users:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseUserQuery(params);
    const result = await listUsers(query);
    return jsonOk(result);
  } catch (error) {
    console.error("[Securis] users list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "users:write")) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await createUser(parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result.ok) return jsonError("A user with this email already exists.", 409);
    return jsonOk(result.user, { status: 201 });
  } catch (error) {
    console.error("[Securis] user create error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
