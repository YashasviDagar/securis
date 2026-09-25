import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { updateUserSchema } from "@/lib/validation/users";
import { getUserById, updateUser } from "@/server/services/user-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/users/[id]
 *
 *   GET   - user detail with login history and activity (`users:read`).
 *   PATCH - change name/role/active state (`users:write`).
 *
 * An administrator cannot disable their own account, which prevents locking
 * everyone out of the console.
 *
 * Connection: server/services/user-service.ts.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "users:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const user = await getUserById(id);
    if (!user) return jsonError("User not found.", 404);
    return jsonOk(user);
  } catch (error) {
    console.error("[Securis] user detail error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "users:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Guard: an administrator must not disable their own account.
    if (id === session.user.id && parsed.data.isActive === false) {
      return jsonError("You cannot disable your own account.", 400);
    }

    const result = await updateUser(id, parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result) return jsonError("User not found.", 404);
    if (!result.ok) return jsonError("A user with this email already exists.", 409);
    return jsonOk(result.user);
  } catch (error) {
    console.error("[Securis] user update error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
