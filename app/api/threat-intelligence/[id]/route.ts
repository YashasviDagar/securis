import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { updateIndicatorSchema } from "@/lib/validation/threat-intel";
import {
  deleteIndicator,
  getIndicatorById,
  updateIndicator,
} from "@/server/threat-intel";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/threat-intelligence/[id]
 *
 *   GET    - the indicator (requires `threat-intel:read`).
 *   PATCH  - update/retire an indicator (requires `threat-intel:write`).
 *   DELETE - remove an indicator (requires `threat-intel:write`).
 *
 * Connection: server/threat-intel (service layer).
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "threat-intel:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const indicator = await getIndicatorById(id);
    if (!indicator) return jsonError("Indicator not found.", 404);
    return jsonOk(indicator);
  } catch (error) {
    console.error("[Securis] indicator detail error:", describeError(error));
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
    if (!hasPermission(session.user.role, "threat-intel:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = updateIndicatorSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await updateIndicator(id, parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result) return jsonError("Indicator not found.", 404);
    if (!result.ok) {
      return jsonError("An indicator with this type and value already exists.", 409);
    }

    return jsonOk(result.indicator);
  } catch (error) {
    console.error("[Securis] indicator update error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "threat-intel:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const deleted = await deleteIndicator(id, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!deleted) return jsonError("Indicator not found.", 404);
    return jsonOk({ deleted: true });
  } catch (error) {
    console.error("[Securis] indicator delete error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
