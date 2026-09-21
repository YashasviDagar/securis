/**
 * Securis - Core security domain types
 *
 * These are the *application-level* definitions of the security vocabulary used
 * across the SIEM. They are intentionally declared as `as const` arrays with
 * derived union types rather than TypeScript `enum`s, because:
 *   1. String literal unions serialise cleanly across the server/client boundary.
 *   2. They can be reused directly by Zod schemas (Phase 4 input validation).
 *   3. They map 1:1 onto the Prisma enums defined in Phase 2.
 *
 * Connection: database/prisma/schema.prisma declares the matching Postgres
 * enums; server/ingestion and server/detection import these types so the
 * business logic never depends on generated Prisma types directly.
 */

/** The three RBAC roles. Ordered from most to least privileged. */
export const ROLES = ["ADMIN", "SECURITY_ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

/** Human-readable descriptions of each role, shown in the user management UI. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full control: users, detection rules, alerts, incidents and audit logs.",
  SECURITY_ANALYST: "Investigate events and alerts and manage incidents.",
  VIEWER: "Read-only access to the security console.",
};

/**
 * Event severity. Used by the detection engine and the deterministic risk
 * scoring engine (Phase 8). The numeric base weights are documented here so the
 * scoring model has a single source of truth.
 */
export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * Base severity weights used by the risk scoring engine.
 * Spec: INFO = 1, LOW = 2, MEDIUM = 5, HIGH = 8, CRITICAL = 10.
 */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  INFO: 1,
  LOW: 2,
  MEDIUM: 5,
  HIGH: 8,
  CRITICAL: 10,
};

/** Numeric ordering of severities, useful for sorting and comparisons. */
export const SEVERITY_ORDER: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * Risk score bands (Phase 8). A score is an integer from 0-100.
 * 0-25 Low, 26-50 Moderate, 51-75 High, 76-100 Critical.
 */
export const RISK_BANDS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

/** Convert a numeric risk score (0-100) into its qualitative band. */
export function riskBandFromScore(score: number): RiskBand {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MODERATE";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

/** The lifecycle states of an alert (Phase 9). */
export const ALERT_STATUSES = [
  "NEW",
  "INVESTIGATING",
  "RESOLVED",
  "FALSE_POSITIVE",
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** The lifecycle states of an incident (Phase 10). */
export const INCIDENT_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "CONTAINED",
  "RESOLVED",
  "CLOSED",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/**
 * The origin of a security event. The ingestion parser (Phase 4) selects a
 * normalisation strategy based on this value.
 */
export const SOURCE_TYPES = [
  "AUTH",
  "WEB",
  "API",
  "SERVER",
  "DATABASE",
  "NETWORK",
  "INFRASTRUCTURE",
  "APPLICATION",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Types of threat intelligence indicators supported (Phase 11). */
export const INDICATOR_TYPES = ["IP", "DOMAIN", "HASH", "URL"] as const;
export type IndicatorType = (typeof INDICATOR_TYPES)[number];
