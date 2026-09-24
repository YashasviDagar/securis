import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BellRing,
  ScrollText,
  ShieldAlert,
  Siren,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { StatCard, ChartCard } from "@/components/dashboard/cards";
import {
  AuthOutcomeChart,
  CategoryBarChart,
  HorizontalBarChart,
  TimeSeriesChart,
} from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/auth/current-user";
import { getDashboardData } from "@/server/services/dashboard-service";
import { formatDateTime, formatNumber } from "@/utils/format";
import type { Severity } from "@/types/security";

export const metadata: Metadata = { title: "Dashboard · Securis" };

/**
 * /dashboard - Security operations dashboard.
 *
 * Server component. Every metric and series is aggregated from the database by
 * the dashboard service; nothing here is hard-coded. Charts are client
 * components (Recharts) that receive the already-aggregated data.
 *
 * Connection: server/services/dashboard-service.ts -> components/dashboard/**.
 */

export const dynamic = "force-dynamic";

/** Severity colours, aligned with the theme tokens. */
const SEVERITY_COLORS: Record<Severity, string> = {
  INFO: "var(--severity-info)",
  LOW: "var(--severity-low)",
  MEDIUM: "var(--severity-medium)",
  HIGH: "var(--severity-high)",
  CRITICAL: "var(--severity-critical)",
};

export default async function DashboardPage() {
  await requirePermission("dashboard:read");

  const data = await getDashboardData();
  const { overview } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Operations Dashboard"
        description="Live posture across events, detections, alerts and incidents."
        actions={
          <span className="text-xs text-muted-foreground">
            Last {data.windowDays} days · {formatNumber(overview.totalEvents)} events total
          </span>
        }
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total Events" value={overview.totalEvents} icon={ScrollText} />
        <StatCard label="Events Today" value={overview.eventsToday} icon={Activity} />
        <StatCard
          label="Critical Alerts"
          value={overview.criticalAlerts}
          icon={ShieldAlert}
          emphasis={overview.criticalAlerts > 0 ? "critical" : "default"}
          hint="Open (NEW / INVESTIGATING)"
        />
        <StatCard
          label="High Alerts"
          value={overview.highAlerts}
          icon={AlertTriangle}
          emphasis={overview.highAlerts > 0 ? "warning" : "default"}
          hint="Open (NEW / INVESTIGATING)"
        />
        <StatCard label="Open Incidents" value={overview.openIncidents} icon={Siren} />
        <StatCard label="Active Users" value={overview.activeUsers} icon={Users} />
        <StatCard label="Suspicious IPs" value={overview.suspiciousIps} icon={BellRing} />
      </div>

      {/* Time series */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Events over time"
          description={`Daily event volume, last ${data.windowDays} days`}
        >
          <TimeSeriesChart data={data.eventsOverTime} color="var(--chart-1)" />
        </ChartCard>
        <ChartCard
          title="Alerts over time"
          description={`Daily alerts raised, last ${data.windowDays} days`}
        >
          <TimeSeriesChart data={data.alertsOverTime} color="var(--chart-5)" />
        </ChartCard>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Events by severity" description="All time">
          <CategoryBarChart data={data.eventsBySeverity} colorByLabel={SEVERITY_COLORS} />
        </ChartCard>
        <ChartCard title="Events by source" description="Top sources">
          <CategoryBarChart data={data.eventsBySource} color="var(--chart-2)" />
        </ChartCard>
        <ChartCard title="Events by event type" description="Top event types">
          <CategoryBarChart data={data.eventsByEventType} color="var(--chart-3)" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Top source IPs" description="Most active event sources">
          <HorizontalBarChart data={data.topSourceIps} color="var(--chart-4)" />
        </ChartCard>
        <ChartCard title="Top targeted users" description="Most referenced accounts">
          <HorizontalBarChart data={data.topTargetedUsers} color="var(--chart-2)" />
        </ChartCard>
        <ChartCard title="Authentication outcomes" description="Successful vs failed logins">
          <AuthOutcomeChart data={data.authOutcomes} />
        </ChartCard>
      </div>

      {/* Recent alerts */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Recent alerts</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/alerts">View all</Link>
          </Button>
        </div>

        {data.recentAlerts.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No alerts yet"
            description="Alerts appear here as soon as the detection engine fires."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Alert</th>
                  <th className="px-3 py-2 font-medium">Source IP</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="line-clamp-1 font-medium text-primary hover:underline"
                      >
                        {alert.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {alert.sourceIp ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{alert.targetUser ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {alert.ruleCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{alert.riskScore}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={alert.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {formatDateTime(alert.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
