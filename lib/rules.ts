import { DEFAULT_RULE_PAGE_SIZE } from "@/lib/validation/rules";
import type { RuleQuery, RuleSortField } from "@/types/rules";

/**
 * Securis - Detection rule URL helpers
 *
 * Pure functions translating a `RuleQuery` into a URL so the rule table keeps
 * its state in the query string.
 *
 * Connection: components/detection-rules/** and
 * app/(soc)/detection-rules/page.tsx.
 */

export function ruleQueryToSearchParams(query: Partial<RuleQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_RULE_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.severity && query.severity.length > 0) {
    params.set("severity", query.severity.join(","));
  }
  if (query.ruleType && query.ruleType.length > 0) {
    params.set("ruleType", query.ruleType.join(","));
  }
  if (query.enabled !== undefined) params.set("enabled", String(query.enabled));
  if (query.sortBy && query.sortBy !== "code") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "asc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build a `/detection-rules` href from a query plus optional overrides. */
export function buildRulesHref(query: RuleQuery, overrides: Partial<RuleQuery> = {}): string {
  const params = ruleQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/detection-rules?${qs}` : "/detection-rules";
}

/** Href that toggles sorting on a column. */
export function buildRuleSortHref(query: RuleQuery, field: RuleSortField): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "asc" ? "desc" : "asc";
  return buildRulesHref(query, { sortBy: field, sortDir, page: 1 });
}
