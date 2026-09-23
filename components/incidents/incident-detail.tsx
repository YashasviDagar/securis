import Link from "next/link";
import { ArrowLeft, Bell, Clock } from "lucide-react";
import { IncidentActions } from "@/components/incidents/incident-actions";
import { RiskScoreBadge } from "@/components/shared/risk-badge";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/format";
import type { IncidentDetail } from "@/types/incidents";
import type { AssignableUser } from "@/components/alerts/alert-actions";

/**
 * Securis - Incident detail view
 *
 * Server component showing the full incident record: identity, severity, status,
 * assignment, resolution, related alerts, related events, notes, the analyst
 * actions panel and the investigation timeline.
 *
 * Connection: app/(soc)/incidents/[id]/page.tsx.
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

export function IncidentDetailView({
  incident,
  users,
  canWrite,
}: {
  incident: IncidentDetail;
  users: AssignableUser[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-border/60 pb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
          <Link href="/incidents">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to incidents
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
            {incident.reference}
          </span>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-foreground">{incident.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{incident.description}</p>
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Incident details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Incident ID">
            <span className="font-mono text-xs">{incident.reference}</span>
          </Fact>
          <Fact label="Severity">
            <SeverityBadge severity={incident.severity} />
          </Fact>
          <Fact label="Status">
            <StatusBadge status={incident.status} />
          </Fact>
          <Fact label="Assigned analyst">
            {incident.assignedTo ? `${incident.assignedTo.name} (${incident.assignedTo.email})` : "Unassigned"}
          </Fact>
          <Fact label="Created">
            <span className="font-mono text-xs">{formatDateTime(incident.createdAt)}</span>
          </Fact>
          <Fact label="Updated">
            <span className="font-mono text-xs">{formatDateTime(incident.updatedAt)}</span>
          </Fact>
          <Fact label="Resolved">
            <span className="font-mono text-xs">{formatDateTime(incident.resolvedAt)}</span>
          </Fact>
          <Fact label="Related alerts">{incident.alertCount}</Fact>
          <Fact label="Related events">{incident.eventCount}</Fact>
        </dl>

        {incident.resolution ? (
          <div className="mt-4 rounded-lg border border-severity-low/30 bg-severity-low/5 p-3">
            <p className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
              Resolution
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{incident.resolution}</p>
          </div>
        ) : null}
      </section>

      <IncidentActions
        incidentId={incident.id}
        status={incident.status}
        assignedToId={incident.assignedTo?.id ?? null}
        resolution={incident.resolution}
        users={users}
        canWrite={canWrite}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            Investigation timeline
          </h2>
          <Timeline notes={incident.notes} events={incident.relatedEvents} />
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
              Related alerts ({incident.alerts.length})
            </h2>
            {incident.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts linked to this incident.</p>
            ) : (
              <ul className="space-y-2">
                {incident.alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-2"
                  >
                    <Link
                      href={`/alerts/${alert.id}`}
                      className="truncate text-sm text-primary hover:underline"
                    >
                      {alert.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <RiskScoreBadge score={alert.riskScore} />
                      <StatusBadge status={alert.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-foreground">
              Related events ({incident.relatedEvents.length})
            </h2>
            {incident.relatedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events linked to this incident.</p>
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
                    {incident.relatedEvents.map((event) => (
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
        </div>
      </div>
    </div>
  );
}
