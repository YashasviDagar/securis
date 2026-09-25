import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseAuditQuery } from "@/lib/validation/audit";
import { listAudits } from "@/server/services/audit-service";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/audit-logs
 *
 * Read-only, paginated, filtered audit trail. Requires `audit:read`
 * (administrator only). The trail is append-only — there is no write endpoint.
 *
 * Connection: lib/validation/audit.ts -> server/services/audit-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "audit:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseAuditQuery(params);
    const result = await listAudits(query);
    return jsonOk(result);
  } catch (error) {
    console.error("[Securis] audit list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
