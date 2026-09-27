import { listEvents } from "@/server/services/event-service";
import { listAlerts } from "@/server/services/alert-service";
import { listIncidents } from "@/server/services/incident-service";
import { listIndicators } from "@/server/threat-intel";
import { listUsers } from "@/server/services/user-service";
import { hasPermission } from "@/auth/rbac";
import type { Role } from "@/types/security";
import type { GlobalSearchResults } from "@/types/search";

/**
 * Securis - Global search service
 *
 * Applies one term across events, alerts, incidents, threat indicators and
 * users by delegating to each domain's existing list service. Reusing those
 * services means search respects exactly the same filters, indexes and
 * projections as the dedicated explorers.
 *
 * Permission-aware: the users group is omitted entirely when the caller cannot
 * read users, so search never leaks a resource the caller may not access.
 *
 * Connection: server/services/* and server/threat-intel.
 */

/** How many preview rows each group returns. */
const PREVIEW_SIZE = 5;

/** Run a global search for `term` as the given role. */
export async function globalSearch(term: string, role: Role): Promise<GlobalSearchResults> {
  const trimmed = term.trim();

  const [events, alerts, incidents, indicators, users] = await Promise.all([
    listEvents({
      page: 1,
      pageSize: PREVIEW_SIZE,
      search: trimmed,
      severity: [],
      sortBy: "timestamp",
      sortDir: "desc",
    }),
    listAlerts({
      page: 1,
      pageSize: PREVIEW_SIZE,
      search: trimmed,
      severity: [],
      status: [],
      sortBy: "createdAt",
      sortDir: "desc",
    }),
    listIncidents({
      page: 1,
      pageSize: PREVIEW_SIZE,
      search: trimmed,
      severity: [],
      status: [],
      sortBy: "createdAt",
      sortDir: "desc",
    }),
    listIndicators({
      page: 1,
      pageSize: PREVIEW_SIZE,
      search: trimmed,
      type: [],
      sortBy: "confidence",
      sortDir: "desc",
    }),
    hasPermission(role, "users:read")
      ? listUsers({
          page: 1,
          pageSize: PREVIEW_SIZE,
          search: trimmed,
          role: [],
          sortBy: "name",
          sortDir: "asc",
        })
      : Promise.resolve(null),
  ]);

  const totalMatches =
    events.total +
    alerts.total +
    incidents.total +
    indicators.total +
    (users?.total ?? 0);

  return {
    term: trimmed,
    events: { total: events.total, items: events.items },
    alerts: { total: alerts.total, items: alerts.items },
    incidents: { total: incidents.total, items: incidents.items },
    indicators: { total: indicators.total, items: indicators.items },
    users: users ? { total: users.total, items: users.items } : null,
    totalMatches,
  };
}
