import type { Paginated } from "./common";
import type { EventListItem } from "./events";
import type { IncidentStatus, Severity } from "./security";

/**
 * Securis - Incident management types
 *
 * An incident is a coordinated investigation built from one or more alerts.
 * Like every list in Securis, the incident board is paginated and filtered on
 * the server.
 *
 * Connection: lib/validation/incidents.ts, server/services/incident-service.ts,
 * app/(soc)/incidents/**, app/api/incidents/**.
 */

/** Columns the incident board can be sorted by. */
export const INCIDENT_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "severity",
  "status",
  "reference",
] as const;
export type IncidentSortField = (typeof INCIDENT_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated incident query. */
export interface IncidentQuery {
  page: number;
  pageSize: number;
  search?: string;
  severity: Severity[];
  status: IncidentStatus[];
  /** Filter by the assigned analyst. */
  assignedToId?: string;
  assigned?: "assigned" | "unassigned";
  from?: Date;
  to?: Date;
  sortBy: IncidentSortField;
  sortDir: SortDirection;
}

/** The analyst assigned to an incident. */
export interface IncidentAssignee {
  id: string;
  name: string;
  email: string;
}

/** A single row in the incident board. */
export interface IncidentListItem {
  id: string;
  reference: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  assignedTo: IncidentAssignee | null;
  alertCount: number;
  eventCount: number;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/** A note attached to an incident. */
export interface IncidentNoteItem {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
}

/** The full incident record shown on the detail page. */
export interface IncidentDetail extends IncidentListItem {
  description: string;
  resolution: string | null;
  /** Alerts bundled into this incident. */
  alerts: {
    id: string;
    title: string;
    severity: Severity;
    status: string;
    riskScore: number;
    sourceIp: string | null;
    targetUser: string | null;
  }[];
  /** The union of the linked alerts' events (the incident timeline). */
  relatedEvents: EventListItem[];
  notes: IncidentNoteItem[];
}

/** Distinct values used to populate the incident filter dropdowns. */
export interface IncidentFacets {
  statuses: IncidentStatus[];
  severities: Severity[];
  analysts: IncidentAssignee[];
}

export type { Paginated };
