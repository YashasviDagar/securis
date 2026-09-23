import { DEFAULT_ALERT_PAGE_SIZE } from "@/lib/validation/alerts";
import type { AlertQuery, AlertSortField } from "@/types/alerts";

/**
 * Securis - Alert query URL helpers
 *
 * Pure functions that translate an `AlertQuery` into a URL, so the alert queue
 * keeps all of its state (filters, sort, page) in the query string. This makes
 * every view shareable and lets the server do all the work.
 *
 * Connection: components/alerts/** and app/(soc)/alerts/page.tsx.
 */

/** Serialise a query to search params, omitting defaults for clean URLs. */
export function alertQueryToSearchParams(query: Partial<AlertQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_ALERT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.severity && query.severity.length > 0) {
    params.set("severity", query.severity.join(","));
  }
  if (query.status && query.status.length > 0) params.set("status", query.status.join(","));
  if (query.sourceIp) params.set("sourceIp", query.sourceIp);
  if (query.targetUser) params.set("targetUser", query.targetUser);
  if (query.ruleCode) params.set("ruleCode", query.ruleCode);
  if (query.assigned) params.set("assigned", query.assigned);
  if (query.from) params.set("from", query.from.toISOString());
  if (query.to) params.set("to", query.to.toISOString());
  if (query.sortBy && query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "desc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build an `/alerts` href from a query plus optional overrides. */
export function buildAlertsHref(
  query: AlertQuery,
  overrides: Partial<AlertQuery> = {},
): string {
  const params = alertQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/alerts?${qs}` : "/alerts";
}

/** Href that toggles sorting on a column. */
export function buildAlertSortHref(query: AlertQuery, field: AlertSortField): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "desc" ? "asc" : "desc";
  return buildAlertsHref(query, { sortBy: field, sortDir, page: 1 });
}
