import type { Paginated } from "./common";
import type { AlertStatus, RuleType, Severity } from "./security";

/**
 * Securis - Detection rule management types
 *
 * Rules are data, not code: the detection engine loads them from the database,
 * so administrators can create, tune, enable and disable them without a
 * deployment.
 *
 * Connection: lib/validation/rules.ts, server/services/rule-service.ts,
 * app/(soc)/detection-rules/**, app/api/detection-rules/**.
 */

/** Columns the rule table can be sorted by. */
export const RULE_SORT_FIELDS = [
  "code",
  "name",
  "severity",
  "ruleType",
  "enabled",
  "createdAt",
  "updatedAt",
] as const;
export type RuleSortField = (typeof RULE_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated rule query. */
export interface RuleQuery {
  page: number;
  pageSize: number;
  /** Free-text search across code, name and description. */
  search?: string;
  severity: Severity[];
  ruleType: RuleType[];
  /** Filter by enabled/disabled status. */
  enabled?: boolean;
  sortBy: RuleSortField;
  sortDir: SortDirection;
}

/** Who created a rule. */
export interface RuleAuthor {
  id: string;
  name: string;
  email: string;
}

/** A single row in the rule table. */
export interface RuleListItem {
  id: string;
  code: string;
  name: string;
  description: string;
  ruleType: RuleType;
  severity: Severity;
  threshold: number | null;
  timeWindowSeconds: number | null;
  enabled: boolean;
  createdBy: RuleAuthor | null;
  createdAt: Date;
  updatedAt: Date;
  /** How many alerts this rule has produced. */
  alertCount: number;
}

/** The full rule record shown on the detail page. */
export interface RuleDetail extends RuleListItem {
  /** The raw, type-specific condition document. */
  condition: unknown;
  /** The most recent alerts this rule produced. */
  recentAlerts: {
    id: string;
    title: string;
    severity: Severity;
    status: AlertStatus;
    riskScore: number;
    createdAt: Date;
  }[];
}

/** Distinct values used to populate the rule filter dropdowns. */
export interface RuleFacets {
  severities: Severity[];
  ruleTypes: RuleType[];
}

export type { Paginated };
