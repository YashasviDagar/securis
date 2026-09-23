import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { updateIncidentSchema } from "@/lib/validation/incidents";
import { getIncidentById, updateIncident } from "@/server/services/incident-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/incidents/[id]
 *
 *   GET   - the full incident record (requires `incidents:read`).
 *   PATCH - update status, assignment, resolution or content
 *           (requires `incidents:write`).
 *
 * Connection: server/services/incident-service.ts.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "incidents:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const incident = await getIncidentById(id);
    if (!incident) return jsonError("Incident not found.", 404);
    return jsonOk(incident);
  } catch (error) {
    console.error("[Securis] incident detail error:", describeError(error));
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
    if (!hasPermission(session.user.role, "incidents:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = updateIncidentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const incident = await updateIncident(id, parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!incident) return jsonError("Incident or assignee not found.", 404);
    return jsonOk(incident);
  } catch (error) {
    console.error("[Securis] incident update error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
