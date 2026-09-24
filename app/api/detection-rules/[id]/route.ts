import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { updateRuleSchema } from "@/lib/validation/rules";
import {
  deleteRule,
  getRuleById,
  updateRule,
} from "@/server/services/rule-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/detection-rules/[id]
 *
 *   GET    - the rule with its condition and recent alerts (`rules:read`).
 *   PATCH  - update content/condition/enabled (`rules:write`).
 *   DELETE - remove the rule (`rules:write`).
 *
 * Connection: server/services/rule-service.ts.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "rules:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const rule = await getRuleById(id);
    if (!rule) return jsonError("Rule not found.", 404);
    return jsonOk(rule);
  } catch (error) {
    console.error("[Securis] rule detail error:", describeError(error));
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
    if (!hasPermission(session.user.role, "rules:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await updateRule(id, parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result) return jsonError("Rule not found.", 404);
    if (!result.ok) return jsonError("A rule with this code already exists.", 409);
    return jsonOk(result.rule);
  } catch (error) {
    console.error("[Securis] rule update error:", describeError(error));
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
    if (!hasPermission(session.user.role, "rules:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const deleted = await deleteRule(id, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!deleted) return jsonError("Rule not found.", 404);
    return jsonOk({ deleted: true });
  } catch (error) {
    console.error("[Securis] rule delete error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
