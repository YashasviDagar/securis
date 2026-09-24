import type { Paginated } from "./common";
import type { IndicatorType } from "./security";

/**
 * Securis - Threat intelligence types
 *
 * The local indicator database: IPs, domains, hashes and URLs that the risk
 * engine checks against. External feeds are isolated behind a service layer
 * (`server/threat-intel/`), so this UI only ever talks to the local database.
 *
 * Connection: lib/validation/threat-intel.ts, server/threat-intel/service.ts,
 * app/(soc)/threat-intelligence/**, app/api/threat-intelligence/**.
 */

/** Columns the indicator table can be sorted by. */
export const INDICATOR_SORT_FIELDS = [
  "value",
  "confidence",
  "firstSeen",
  "lastSeen",
  "createdAt",
] as const;
export type IndicatorSortField = (typeof INDICATOR_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated indicator query. */
export interface IndicatorQuery {
  page: number;
  pageSize: number;
  /** Free-text search across value, threat type, source and description. */
  search?: string;
  type: IndicatorType[];
  threatType?: string;
  source?: string;
  /** Only indicators with at least this confidence (0-100). */
  confidenceMin?: number;
  /** Filter by active/retired status. */
  active?: boolean;
  sortBy: IndicatorSortField;
  sortDir: SortDirection;
}

/** A single row in the indicator table. */
export interface IndicatorListItem {
  id: string;
  type: IndicatorType;
  value: string;
  threatType: string | null;
  confidence: number;
  source: string;
  description: string | null;
  firstSeen: Date;
  lastSeen: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Distinct values used to populate the indicator filter dropdowns. */
export interface IndicatorFacets {
  types: IndicatorType[];
  threatTypes: string[];
  sources: string[];
}

export type { Paginated };
