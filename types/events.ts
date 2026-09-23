import type { AlertStatus, IncidentStatus, Severity, SourceType } from "./security";

/**
 * Securis - Event explorer types
 *
 * Describes the server-side query contract for `/events` and the shapes
 * returned to the UI and the API. The event explorer is always paginated on the
 * server: the browser never receives more than `pageSize` rows.
 *
 * Connection: lib/validation/events.ts (parsing), server/services/event-service.ts
 * (querying), app/(soc)/events/** (rendering), app/api/events/** (API).
 */

/** Columns the event table can be sorted by. */
export const EVENT_SORT_FIELDS = ["timestamp", "severity", "eventType", "source"] as const;
export type EventSortField = (typeof EVENT_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated event query. */
export interface EventQuery {
  page: number;
  pageSize: number;
  /** Free-text search across message, username, IP, source and resource. */
  search?: string;
  /** One or more severities to include (empty = all). */
  severity: Severity[];
  eventType?: string;
  source?: string;
  sourceType?: SourceType;
  sourceIp?: string;
  username?: string;
  status?: string;
  /** Inclusive lower bound on the event timestamp. */
  from?: Date;
  /** Inclusive upper bound on the event timestamp. */
  to?: Date;
  sortBy: EventSortField;
  sortDir: SortDirection;
}

/** A single row in the event table (a trimmed projection for performance). */
export interface EventListItem {
  id: string;
  timestamp: Date;
  source: string;
  sourceType: SourceType;
  eventType: string;
  severity: Severity;
  username: string | null;
  sourceIp: string | null;
  status: string | null;
  message: string;
}

/** The full event record shown on the detail page. */
export interface EventDetail extends EventListItem {
  destinationIp: string | null;
  userAgent: string | null;
  resource: string | null;
  action: string | null;
  metadata: unknown;
  createdAt: Date;
  /** Alerts this event contributed to (populated once detection runs). */
  relatedAlerts: {
    id: string;
    title: string;
    severity: Severity;
    status: AlertStatus;
    riskScore: number;
    riskFactors: unknown;
  }[];
  /** Incidents this event is part of. */
  relatedIncidents: {
    id: string;
    reference: string;
    title: string;
    status: IncidentStatus;
  }[];
}

/** Generic paginated envelope used by every list in Securis. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Distinct values used to populate the filter dropdowns (real data). */
export interface EventFacets {
  sources: string[];
  eventTypes: string[];
  statuses: string[];
}
