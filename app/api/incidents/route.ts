import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { createIncidentSchema, parseIncidentQuery } from "@/lib/validation/incidents";
import { createIncident, listIncidents } from "@/server/services/incident-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/incidents
 *
 *   GET  - paginated, filtered incident board (requires `incidents:read`).
 *   POST - create an incident from one or more alerts (requires `incidents:write`).
 *
 * Connection: lib/validation/incidents.ts -> server/services/incident-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "incidents:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseIncidentQuery(params);
    const result = await listIncidents(query);

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
    console.error("[Securis] incidents list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "incidents:write")) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = createIncidentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const incident = await createIncident(parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!incident) {
      return jsonError("One or more alerts or the assignee could not be found.", 404);
    }

    return jsonOk(incident, { status: 201 });
  } catch (error) {
    console.error("[Securis] incident create error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
