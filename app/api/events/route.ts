import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseEventQuery } from "@/lib/validation/events";
import { listEvents } from "@/server/services/event-service";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/events
 *
 * Server-side paginated, filtered and sorted event list. Requires an
 * authenticated session holding `events:read`.
 *
 * The web UI renders the explorer with server components and does not call this
 * endpoint; it exists for programmatic access, integrations and automated tests.
 *
 * Connection: lib/validation/events.ts -> server/services/event-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "events:read")) {
      return jsonError("Forbidden.", 403);
    }

    // Convert URLSearchParams into the raw bag the parser expects.
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseEventQuery(params);
    const result = await listEvents(query);

    return jsonOk({
      ...result,
      query: {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      },
    });
  } catch (error) {
    console.error("[Securis] events list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
