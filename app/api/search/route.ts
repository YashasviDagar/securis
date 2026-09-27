import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { globalSearch } from "@/server/services/search-service";
import { describeError, jsonError, jsonOk } from "@/server/http/request";

/**
 * GET /api/search?q=<term>
 *
 * Global search across events, alerts, incidents, threat indicators and users.
 * Requires an authenticated session with at least `events:read`; the users group
 * is only included when the caller can read users.
 *
 * Connection: server/services/search-service.ts.
 */

export const runtime = "nodejs";

/** Guard against pathologically long search terms. */
const MAX_TERM_LENGTH = 200;

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "events:read")) {
      return jsonError("Forbidden.", 403);
    }

    const term = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (!term) return jsonError("Provide a search term (q).", 400);
    if (term.length > MAX_TERM_LENGTH) return jsonError("Search term is too long.", 400);

    const results = await globalSearch(term, session.user.role);
    return jsonOk(results);
  } catch (error) {
    console.error("[Securis] global search error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
