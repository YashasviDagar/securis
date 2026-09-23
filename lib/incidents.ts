import { DEFAULT_INCIDENT_PAGE_SIZE } from "@/lib/validation/incidents";
import type { IncidentQuery, IncidentSortField } from "@/types/incidents";

/**
 * Securis - Incident query URL helpers
 *
 * Pure functions translating an `IncidentQuery` into a URL so the incident
 * board keeps all of its state in the query string.
 *
 * Connection: components/incidents/** and app/(soc)/incidents/page.tsx.
 */

export function incidentQueryToSearchParams(
  query: Partial<IncidentQuery>,
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_INCIDENT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.severity && query.severity.length > 0) {
    params.set("severity", query.severity.join(","));
  }
  if (query.status && query.status.length > 0) params.set("status", query.status.join(","));
  if (query.assignedToId) params.set("assignedToId", query.assignedToId);
  if (query.assigned) params.set("assigned", query.assigned);
  if (query.from) params.set("from", query.from.toISOString());
  if (query.to) params.set("to", query.to.toISOString());
  if (query.sortBy && query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "desc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build an `/incidents` href from a query plus optional overrides. */
export function buildIncidentsHref(
  query: IncidentQuery,
  overrides: Partial<IncidentQuery> = {},
): string {
  const params = incidentQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/incidents?${qs}` : "/incidents";
}

/** Href that toggles sorting on a column. */
export function buildIncidentSortHref(
  query: IncidentQuery,
  field: IncidentSortField,
): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "desc" ? "asc" : "desc";
  return buildIncidentsHref(query, { sortBy: field, sortDir, page: 1 });
}
