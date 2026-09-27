import type { AlertListItem } from "./alerts";
import type { EventListItem } from "./events";
import type { IncidentListItem } from "./incidents";
import type { IndicatorListItem } from "./threat-intel";
import type { UserListItem } from "./users";

/**
 * Securis - Global search types
 *
 * A single search term is applied across every entity type. The overview shows
 * a small preview of each group plus the total, and links into the relevant
 * module (which already provides its own filtering and pagination).
 *
 * Connection: server/services/search-service.ts, app/(soc)/search/page.tsx.
 */

/** One entity group in the search results. */
export interface SearchGroup<T> {
  /** Total matches for this entity type. */
  total: number;
  /** A small preview of matches. */
  items: T[];
}

/** Results across every searchable entity. */
export interface GlobalSearchResults {
  term: string;
  events: SearchGroup<EventListItem>;
  alerts: SearchGroup<AlertListItem>;
  incidents: SearchGroup<IncidentListItem>;
  indicators: SearchGroup<IndicatorListItem>;
  /** Null when the caller lacks permission to read users. */
  users: SearchGroup<UserListItem> | null;
  /** Sum of every group's total. */
  totalMatches: number;
}
