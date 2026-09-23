import Link from "next/link";
import { ArrowLeft, Bell, Clock, Siren } from "lucide-react";
import { AlertActions, type AssignableUser } from "@/components/alerts/alert-actions";
import { AlertTimeline } from "@/components/alerts/alert-timeline";
import { RiskMeter, RiskScoreBadge } from "@/components/shared/risk-badge";
import { RiskFactorList } from "@/components/shared/risk-factors";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/format";
import type { AlertDetail } from "@/types/alerts";

/**
 * Securis - Alert detail view
 *
 * Server component showing the full alert record: identity, severity, risk
 * score with its factor breakdown, detection rule, source/target, timing,
 * assignment, related events and incidents, the analyst actions panel and the
 * investigation timeline.
 *
 * Connection: app/(soc)/alerts/[id]/page.tsx.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function AlertDetailView({
  alert,
  users,
  canWrite,
}: {
  alert: AlertDetail;
  users: AssignableUser[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-border/60 pb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
          <Link href="/alerts">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to alerts
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
          <RiskScoreBadge score={alert.riskScore} />
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-foreground">{alert.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{alert.description}</p>

        <div className="flex items-center gap-3">
          <RiskMeter score={alert.riskScore} className="max-w-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border/60 bg-card/40 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-foreground">Alert details</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Alert ID">
              <span className="font-mono text-xs break-all">{alert.id}</span>
            </Fact>
            <Fact label="Detection rule">
              {alert.ruleCode ? (
                <span className="font-mono text-xs">
                  {alert.ruleCode}
                  {alert.ruleName ? ` · ${alert.ruleName}` : ""}
                </span>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Risk score">
              {alert.riskScore}/100
            </Fact>
            <Fact label="Source IP">
              <span className="font-mono text-xs">{alert.sourceIp ?? "—"}</span>
            </Fact>
            <Fact label="Target user">{alert.targetUser ?? "—"}</Fact>
            <Fact label="Assigned analyst">
              {alert.assignedTo ? `${alert.assignedTo.name} (${alert.assignedTo.email})` : "Unassigned"}
            </Fact>
            <Fact label="First seen">
              <span className="font-mono text-xs">{formatDateTime(alert.firstSeen)}</span>
            </Fact>
            <Fact label="Last seen">
              <span className="font-mono text-xs">{formatDateTime(alert.lastSeen)}</span>
            </Fact>
            <Fact label="Created">
              <span className="font-mono text-xs">{formatDateTime(alert.createdAt)}</span>
            </Fact>
            <Fact label="Resolved">
              <span className="font-mono text-xs">{formatDateTime(alert.resolvedAt)}</span>
            </Fact>
            <Fact label="Related events">{alert.eventCount}</Fact>
            <Fact label="Notes">{alert.noteCount}</Fact>
          </dl>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">Risk assessment</h2>
          <RiskFactorList factors={alert.riskFactors} />
        </section>
      </div>

      <AlertActions
        alertId={alert.id}
        status={alert.status}
        assignedToId={alert.assignedTo?.id ?? null}
        users={users}
        canWrite={canWrite}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            Investigation timeline
          </h2>
          <AlertTimeline notes={alert.notes} events={alert.relatedEvents} />
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
              Related events ({alert.relatedEvents.length})
            </h2>
            {alert.relatedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events linked to this alert.</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-lg border border-border/50">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Time</th>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                      <th className="px-2 py-1.5 font-medium">Severity</th>
                      <th className="px-2 py-1.5 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alert.relatedEvents.map((event) => (
                      <tr key={event.id} className="border-t border-border/40">
                        <td className="px-2 py-1.5 font-mono text-[0.68rem] text-muted-foreground">
                          {formatDateTime(event.timestamp)}
                        </td>
                        <td className="px-2 py-1.5">
                          <Link
                            href={`/events/${event.id}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {event.eventType}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">
                          <SeverityBadge severity={event.severity} />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[0.68rem] text-muted-foreground">
                          {event.sourceIp ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Siren className="size-4 text-muted-foreground" aria-hidden="true" />
              Related incidents ({alert.relatedIncidents.length})
            </h2>
            {alert.relatedIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This alert is not part of any incident.
              </p>
            ) : (
              <ul className="space-y-2">
                {alert.relatedIncidents.map((incident) => (
                  <li key={incident.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="truncate text-sm text-primary hover:underline"
                    >
                      <span className="font-mono text-xs">{incident.reference}</span> · {incident.title}
                    </Link>
                    <StatusBadge status={incident.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
