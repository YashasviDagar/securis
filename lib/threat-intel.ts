import { DEFAULT_INDICATOR_PAGE_SIZE } from "@/lib/validation/threat-intel";
import type { IndicatorQuery, IndicatorSortField } from "@/types/threat-intel";

/**
 * Securis - Threat intelligence URL helpers
 *
 * Pure functions translating an `IndicatorQuery` into a URL so the indicator
 * explorer keeps all of its state in the query string.
 *
 * Connection: components/threat-intel/** and
 * app/(soc)/threat-intelligence/page.tsx.
 */

export function indicatorQueryToSearchParams(
  query: Partial<IndicatorQuery>,
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_INDICATOR_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.type && query.type.length > 0) params.set("type", query.type.join(","));
  if (query.threatType) params.set("threatType", query.threatType);
  if (query.source) params.set("source", query.source);
  if (query.confidenceMin !== undefined) params.set("confidenceMin", String(query.confidenceMin));
  if (query.active !== undefined) params.set("active", String(query.active));
  if (query.sortBy && query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "desc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build a `/threat-intelligence` href from a query plus optional overrides. */
export function buildIndicatorsHref(
  query: IndicatorQuery,
  overrides: Partial<IndicatorQuery> = {},
): string {
  const params = indicatorQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/threat-intelligence?${qs}` : "/threat-intelligence";
}

/** Href that toggles sorting on a column. */
export function buildIndicatorSortHref(
  query: IndicatorQuery,
  field: IndicatorSortField,
): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "desc" ? "asc" : "desc";
  return buildIndicatorsHref(query, { sortBy: field, sortDir, page: 1 });
}
