import { DEFAULT_PAGE_SIZE } from "@/lib/validation/events";
import type { EventQuery, EventSortField } from "@/types/events";

/**
 * Securis - Event query URL helpers
 *
 * Pure, dependency-free functions that translate an `EventQuery` into a URL.
 * The event explorer drives all of its state through the URL, which means
 * pagination, filtering and sorting are performed entirely on the server and
 * every view is shareable/bookmarkable.
 *
 * Connection: used by the event filter, table and pagination components.
 */

/** Serialise a query to search params, omitting defaults for clean URLs. */
export function eventQueryToSearchParams(query: Partial<EventQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.severity && query.severity.length > 0) {
    params.set("severity", query.severity.join(","));
  }
  if (query.eventType) params.set("eventType", query.eventType);
  if (query.source) params.set("source", query.source);
  if (query.sourceType) params.set("sourceType", query.sourceType);
  if (query.sourceIp) params.set("sourceIp", query.sourceIp);
  if (query.username) params.set("username", query.username);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from.toISOString());
  if (query.to) params.set("to", query.to.toISOString());
  if (query.sortBy && query.sortBy !== "timestamp") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "desc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build an `/events` href from a query plus optional overrides. */
export function buildEventsHref(
  query: EventQuery,
  overrides: Partial<EventQuery> = {},
): string {
  const params = eventQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/events?${qs}` : "/events";
}

/**
 * Href that toggles sorting on a column. Clicking the active column flips the
 * direction; clicking a new column starts descending (newest/highest first).
 */
export function buildSortHref(query: EventQuery, field: EventSortField): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "desc" ? "asc" : "desc";
  return buildEventsHref(query, { sortBy: field, sortDir, page: 1 });
}
