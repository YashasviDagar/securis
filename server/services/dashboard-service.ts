import { prisma } from "@/database/client";
import { SEVERITY_ORDER, type Severity } from "@/types/security";
import type {
  AuthOutcomePoint,
  CategoryPoint,
  DashboardData,
  TimeSeriesPoint,
} from "@/types/dashboard";

/**
 * Securis - Dashboard service
 *
 * Aggregates the operational picture directly from the database. Nothing on the
 * dashboard is hard-coded: every number and every series is a query result.
 *
 * Time series are bucketed by UTC day over a fixed window. Bucketing happens in
 * application code over a bounded row set (the window), which keeps the query
 * portable and avoids raw SQL date functions.
 *
 * Connection: database/client.ts.
 */

/** Number of days covered by the events/alerts time series. */
export const DASHBOARD_WINDOW_DAYS = 14;

/** Start of the current UTC day. */
function startOfUtcDay(reference: Date = new Date()): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
}

/** `YYYY-MM-DD` key for a timestamp (UTC). */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The list of day keys covering the last `days` days, oldest first. */
function dayKeys(days: number): string[] {
  const today = startOfUtcDay();
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    keys.push(dayKey(date));
  }
  return keys;
}

/** Bucket timestamps into a continuous daily series (zero-filled). */
function bucketByDay(dates: Date[], days: number): TimeSeriesPoint[] {
  const counts = new Map<string, number>();
  for (const key of dayKeys(days)) counts.set(key, 0);
  for (const date of dates) {
    const key = dayKey(date);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

/** Sort category points by count descending and keep the top N. */
function topN(points: CategoryPoint[], n: number): CategoryPoint[] {
  return [...points].sort((a, b) => b.count - a.count).slice(0, n);
}

/** Collect the complete dashboard payload. */
export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const windowStart = new Date(
    todayStart.getTime() - (DASHBOARD_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
  );

  const [
    totalEvents,
    eventsToday,
    criticalAlerts,
    highAlerts,
    openIncidents,
    activeUsers,
    suspiciousIpRows,
    recentEventTimestamps,
    recentAlertTimestamps,
    severityGroups,
    sourceGroups,
    eventTypeGroups,
    sourceIpGroups,
    usernameGroups,
    loginSuccess,
    loginFailed,
    recentAlerts,
  ] = await Promise.all([
    prisma.securityEvent.count(),
    prisma.securityEvent.count({ where: { timestamp: { gte: todayStart } } }),
    prisma.alert.count({ where: { severity: "CRITICAL", status: { in: ["NEW", "INVESTIGATING"] } } }),
    prisma.alert.count({ where: { severity: "HIGH", status: { in: ["NEW", "INVESTIGATING"] } } }),
    prisma.incident.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.alert.findMany({
      where: { sourceIp: { not: null } },
      select: { sourceIp: true },
      distinct: ["sourceIp"],
      take: 500,
    }),
    prisma.securityEvent.findMany({
      where: { timestamp: { gte: windowStart } },
      select: { timestamp: true },
    }),
    prisma.alert.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.securityEvent.groupBy({ by: ["severity"], _count: { _all: true } }),
    prisma.securityEvent.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.securityEvent.groupBy({ by: ["eventType"], _count: { _all: true } }),
    prisma.securityEvent.groupBy({
      by: ["sourceIp"],
      _count: { _all: true },
      where: { sourceIp: { not: null } },
    }),
    prisma.securityEvent.groupBy({
      by: ["username"],
      _count: { _all: true },
      where: { username: { not: null } },
    }),
    prisma.securityEvent.count({ where: { eventType: "LOGIN_SUCCESS" } }),
    prisma.securityEvent.count({ where: { eventType: "LOGIN_FAILED" } }),
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        riskScore: true,
        sourceIp: true,
        targetUser: true,
        createdAt: true,
        rule: { select: { code: true } },
      },
    }),
  ]);

  const eventsBySeverity: CategoryPoint[] = severityGroups
    .map((row) => ({ label: row.severity, count: row._count._all }))
    .sort((a, b) => SEVERITY_ORDER[a.label as Severity] - SEVERITY_ORDER[b.label as Severity]);

  const authOutcomes: AuthOutcomePoint[] = [
    { outcome: "SUCCESS", count: loginSuccess },
    { outcome: "FAILURE", count: loginFailed },
  ];

  return {
    overview: {
      totalEvents,
      eventsToday,
      criticalAlerts,
      highAlerts,
      openIncidents,
      activeUsers,
      suspiciousIps: suspiciousIpRows.length,
    },
    eventsOverTime: bucketByDay(
      recentEventTimestamps.map((row) => row.timestamp),
      DASHBOARD_WINDOW_DAYS,
    ),
    alertsOverTime: bucketByDay(
      recentAlertTimestamps.map((row) => row.createdAt),
      DASHBOARD_WINDOW_DAYS,
    ),
    eventsBySeverity,
    eventsBySource: topN(
      sourceGroups.map((row) => ({ label: row.source, count: row._count._all })),
      8,
    ),
    eventsByEventType: topN(
      eventTypeGroups.map((row) => ({ label: row.eventType, count: row._count._all })),
      8,
    ),
    topSourceIps: topN(
      sourceIpGroups
        .filter((row) => row.sourceIp !== null)
        .map((row) => ({ label: row.sourceIp as string, count: row._count._all })),
      8,
    ),
    topTargetedUsers: topN(
      usernameGroups
        .filter((row) => row.username !== null)
        .map((row) => ({ label: row.username as string, count: row._count._all })),
      8,
    ),
    authOutcomes,
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      riskScore: alert.riskScore,
      sourceIp: alert.sourceIp,
      targetUser: alert.targetUser,
      ruleCode: alert.rule?.code ?? null,
      createdAt: alert.createdAt,
    })),
    windowDays: DASHBOARD_WINDOW_DAYS,
  };
}
