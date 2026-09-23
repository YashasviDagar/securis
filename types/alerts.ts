import type { Paginated } from "./common";
import type { EventListItem } from "./events";
import type {
  AlertStatus,
  IncidentStatus,
  Severity,
} from "./security";

/**
 * Securis - Alert management types
 *
 * Describes the server-side query contract for `/alerts` and the shapes
 * returned to the UI and the API. Like the event explorer, the alert queue is
 * paginated and filtered on the server.
 *
 * Connection: lib/validation/alerts.ts, server/services/alert-service.ts,
 * app/(soc)/alerts/**, app/api/alerts/**.
 */

/** Columns the alert queue can be sorted by. */
export const ALERT_SORT_FIELDS = [
  "createdAt",
  "firstSeen",
  "lastSeen",
  "riskScore",
  "severity",
  "status",
] as const;
export type AlertSortField = (typeof ALERT_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated alert query. */
export interface AlertQuery {
  page: number;
  pageSize: number;
  search?: string;
  severity: Severity[];
  status: AlertStatus[];
  sourceIp?: string;
  targetUser?: string;
  /** Filter by the detection rule that produced the alert. */
  ruleCode?: string;
  /** Only alerts that are currently assigned / unassigned. */
  assigned?: "assigned" | "unassigned";
  from?: Date;
  to?: Date;
  sortBy: AlertSortField;
  sortDir: SortDirection;
}

/** The analyst assigned to an alert. */
export interface AlertAssignee {
  id: string;
  name: string;
  email: string;
}

/** A single row in the alert queue. */
export interface AlertListItem {
  id: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  riskScore: number;
  sourceIp: string | null;
  targetUser: string | null;
  ruleCode: string | null;
  ruleName: string | null;
  firstSeen: Date;
  lastSeen: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  assignedTo: AlertAssignee | null;
  eventCount: number;
  noteCount: number;
}

/** A note attached to an alert. */
export interface AlertNoteItem {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
}

/** The full alert record shown on the detail page. */
export interface AlertDetail extends AlertListItem {
  description: string;
  /** Itemised risk factor breakdown (see server/detection/risk.ts). */
  riskFactors: unknown;
  relatedEvents: EventListItem[];
  relatedIncidents: {
    id: string;
    reference: string;
    title: string;
    status: IncidentStatus;
  }[];
  notes: AlertNoteItem[];
}

/** Distinct values used to populate the alert filter dropdowns. */
export interface AlertFacets {
  rules: { code: string; name: string }[];
  statuses: AlertStatus[];
  severities: Severity[];
}

export type { Paginated };
