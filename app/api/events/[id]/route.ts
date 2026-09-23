import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { getEventById } from "@/server/services/event-service";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/events/[id]
 *
 * Returns the full event record with its related alerts and incidents.
 * Requires `events:read`. Unknown ids return 404.
 *
 * Connection: server/services/event-service.ts (getEventById).
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "events:read")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;
    const event = await getEventById(id);
    if (!event) return jsonError("Event not found.", 404);

    return jsonOk(event);
  } catch (error) {
    console.error("[Securis] event detail error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
