import type { AlertStatus, Severity } from "./security";

/**
 * Securis - Dashboard types
 *
 * Every value here is computed from the database at request time. There are no
 * hard-coded statistics anywhere in the dashboard.
 *
 * Connection: server/services/dashboard-service.ts -> app/(soc)/dashboard.
 */

/** Headline counters shown as cards. */
export interface DashboardOverview {
  totalEvents: number;
  eventsToday: number;
  /** Open (NEW / INVESTIGATING) alerts at CRITICAL severity. */
  criticalAlerts: number;
  /** Open alerts at HIGH severity. */
  highAlerts: number;
  /** Incidents that are not RESOLVED or CLOSED. */
  openIncidents: number;
  activeUsers: number;
  /** Distinct source IPs seen across alerts. */
  suspiciousIps: number;
}

/** A point in a time series (date is an ISO `YYYY-MM-DD`). */
export interface TimeSeriesPoint {
  date: string;
  count: number;
}

/** A labelled count used by the categorical charts. */
export interface CategoryPoint {
  label: string;
  count: number;
}

/** Successful vs failed authentication counts. */
export interface AuthOutcomePoint {
  outcome: "SUCCESS" | "FAILURE";
  count: number;
}

/** A row in the recent-alerts table. */
export interface RecentAlertItem {
  id: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  riskScore: number;
  sourceIp: string | null;
  targetUser: string | null;
  ruleCode: string | null;
  createdAt: Date;
}

/** The complete dashboard payload. */
export interface DashboardData {
  overview: DashboardOverview;
  eventsOverTime: TimeSeriesPoint[];
  alertsOverTime: TimeSeriesPoint[];
  eventsBySeverity: CategoryPoint[];
  eventsBySource: CategoryPoint[];
  eventsByEventType: CategoryPoint[];
  topSourceIps: CategoryPoint[];
  topTargetedUsers: CategoryPoint[];
  authOutcomes: AuthOutcomePoint[];
  recentAlerts: RecentAlertItem[];
  /** Number of days covered by the time series. */
  windowDays: number;
}
