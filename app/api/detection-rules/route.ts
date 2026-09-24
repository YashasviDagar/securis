import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { createRuleSchema, parseRuleQuery } from "@/lib/validation/rules";
import { createRule, listRules } from "@/server/services/rule-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * /api/detection-rules
 *
 *   GET  - paginated, filtered rule list (requires `rules:read`).
 *   POST - create a rule (requires `rules:write`).
 *
 * Connection: lib/validation/rules.ts -> server/services/rule-service.ts.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "rules:read")) {
      return jsonError("Forbidden.", 403);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = parseRuleQuery(params);
    const result = await listRules(query);
    return jsonOk(result);
  } catch (error) {
    console.error("[Securis] rules list error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "rules:write")) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await createRule(parsed.data, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result.ok) return jsonError("A rule with this code already exists.", 409);
    return jsonOk(result.rule, { status: 201 });
  } catch (error) {
    console.error("[Securis] rule create error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
