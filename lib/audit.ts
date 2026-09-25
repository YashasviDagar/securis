import { DEFAULT_AUDIT_PAGE_SIZE } from "@/lib/validation/audit";
import type { AuditQuery, AuditSortField } from "@/types/audit";

/**
 * Securis - Audit URL helpers
 *
 * Connection: components/audit/** and app/(soc)/audit-logs/page.tsx.
 */

export function auditQueryToSearchParams(query: Partial<AuditQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_AUDIT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.action) params.set("action", query.action);
  if (query.actorEmail) params.set("actorEmail", query.actorEmail);
  if (query.targetType) params.set("targetType", query.targetType);
  if (query.ipAddress) params.set("ipAddress", query.ipAddress);
  if (query.from) params.set("from", query.from.toISOString());
  if (query.to) params.set("to", query.to.toISOString());
  if (query.sortBy && query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "desc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build an `/audit-logs` href from a query plus optional overrides. */
export function buildAuditHref(query: AuditQuery, overrides: Partial<AuditQuery> = {}): string {
  const params = auditQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/audit-logs?${qs}` : "/audit-logs";
}

/** Href that toggles sorting on a column. */
export function buildAuditSortHref(query: AuditQuery, field: AuditSortField): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "desc" ? "asc" : "desc";
  return buildAuditHref(query, { sortBy: field, sortDir, page: 1 });
}
