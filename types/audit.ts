import type { Paginated } from "./common";

/**
 * Securis - Audit log types
 *
 * The audit trail is append-only: the UI only ever reads it. Records have been
 * written by every privileged action since Phase 3.
 *
 * Connection: lib/validation/audit.ts, server/services/audit-service.ts,
 * app/(soc)/audit-logs/**, app/api/audit-logs.
 */

/** Columns the audit table can be sorted by. */
export const AUDIT_SORT_FIELDS = ["createdAt", "action", "actorEmail"] as const;
export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated audit query. */
export interface AuditQuery {
  page: number;
  pageSize: number;
  /** Free-text search across action, actor, target and IP. */
  search?: string;
  action?: string;
  actorEmail?: string;
  targetType?: string;
  ipAddress?: string;
  from?: Date;
  to?: Date;
  sortBy: AuditSortField;
  sortDir: SortDirection;
}

/** A single audit row. */
export interface AuditListItem {
  id: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}

/** Distinct values used to populate the audit filter dropdowns. */
export interface AuditFacets {
  actions: string[];
  targetTypes: string[];
  actors: string[];
}

export type { Paginated };
