import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseAlertQuery } from "@/lib/validation/alerts";
import { listAlerts } from "@/server/services/alert-service";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/alerts
 *
 * Server-side paginated, filtered and sorted alert queue. Requires an
 * authenticated session holding `alerts:read`.
 *
 * The UI renders the queue with server components and does not call this
 * endpoint; it exists for programmatic access and automated tests.
 *
 * Connection: lib/validation/alerts.ts -> server/services/alert-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "alerts:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseAlertQuery(params);
    const result = await listAlerts(query);

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
    console.error("[Securis] alerts list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
