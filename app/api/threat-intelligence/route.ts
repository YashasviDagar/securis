import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import {
  createIndicatorSchema,
  parseIndicatorQuery,
} from "@/lib/validation/threat-intel";
import { createIndicator, listIndicators } from "@/server/threat-intel";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/threat-intelligence
 *
 *   GET  - paginated, filtered indicator list (requires `threat-intel:read`).
 *   POST - add an indicator (requires `threat-intel:write`).
 *
 * Connection: server/threat-intel (service layer).
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "threat-intel:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseIndicatorQuery(params);
    const result = await listIndicators(query);

    return jsonOk(result);
  } catch (error) {
    console.error("[Securis] indicators list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "threat-intel:write")) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = createIndicatorSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await createIndicator(parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result.ok) {
      return jsonError("An indicator with this type and value already exists.", 409);
    }

    return jsonOk(result.indicator, { status: 201 });
  } catch (error) {
    console.error("[Securis] indicator create error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
