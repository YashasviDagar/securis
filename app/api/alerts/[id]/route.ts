import { z } from "zod";
import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import {
  assignAlert,
  getAlertById,
  updateAlertStatus,
} from "@/server/services/alert-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";
import { ALERT_STATUSES } from "@/types/security";

/**
 * /api/alerts/[id]
 *
 *   GET   - the full alert record (requires `alerts:read`).
 *   PATCH - update status and/or assignee (requires `alerts:write`).
 *
 * Connection: server/services/alert-service.ts.
 */

export const runtime = "nodejs";

const patchSchema = z
  .object({
    status: z.enum(ALERT_STATUSES).optional(),
    assignedToId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.assignedToId !== undefined, {
    message: "Provide a status or an assignee.",
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "alerts:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const alert = await getAlertById(id);
    if (!alert) return jsonError("Alert not found.", 404);
    return jsonOk(alert);
  } catch (error) {
    console.error("[Securis] alert detail error:", describeError(error));
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
    if (!hasPermission(session.user.role, "alerts:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const actor = {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    };

    let updated = null;
    if (parsed.data.status !== undefined) {
      updated = await updateAlertStatus(id, parsed.data.status, actor);
      if (!updated) return jsonError("Alert not found.", 404);
    }
    if (parsed.data.assignedToId !== undefined) {
      updated = await assignAlert(id, parsed.data.assignedToId, actor);
      if (!updated) return jsonError("Alert or assignee not found.", 404);
    }

    return jsonOk(updated);
  } catch (error) {
    console.error("[Securis] alert update error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
