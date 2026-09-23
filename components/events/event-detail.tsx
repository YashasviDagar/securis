import Link from "next/link";
import { ArrowLeft, Bell, Siren } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/format";
import type { EventDetail } from "@/types/events";

/**
 * Securis - Event detail view
 *
 * Server component showing the complete event record: every field required by
 * the specification (timestamp, source, event type, severity, username, source
 * and destination IP, user agent, resource, action, status, message, metadata)
 * plus the alerts and incidents the event contributed to.
 *
 * Connection: app/(soc)/events/[id]/page.tsx.
 */

/** A single labelled value in the detail grid. */
function DetailItem({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-xs text-foreground" : "text-sm text-foreground"}>
        {children}
      </dd>
    </div>
  );
}

export function EventDetailView({ event }: { event: EventDetail }) {
  // Pretty-print metadata for investigation; guard against non-serialisable data.
  let metadataJson: string | null = null;
  if (event.metadata) {
    try {
      metadataJson = JSON.stringify(event.metadata, null, 2);
    } catch {
      metadataJson = null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/events">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to events
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={event.severity} />
            <h1 className="font-mono text-base font-semibold tracking-tight text-foreground">
              {event.eventType}
            </h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{event.message}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-mono text-[0.7rem] break-all">{event.id}</div>
          <div className="mt-1">Ingested {formatDateTime(event.createdAt)}</div>
        </div>
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Event fields</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Timestamp" mono>
            {formatDateTime(event.timestamp)}
          </DetailItem>
          <DetailItem label="Source">{event.source}</DetailItem>
          <DetailItem label="Source type" mono>
            {event.sourceType}
          </DetailItem>
          <DetailItem label="Event type" mono>
            {event.eventType}
          </DetailItem>
          <DetailItem label="Severity">
            <SeverityBadge severity={event.severity} />
          </DetailItem>
          <DetailItem label="Username" mono>
            {event.username ?? "—"}
          </DetailItem>
          <DetailItem label="Source IP" mono>
            {event.sourceIp ?? "—"}
          </DetailItem>
          <DetailItem label="Destination IP" mono>
            {event.destinationIp ?? "—"}
          </DetailItem>
          <DetailItem label="Status">{event.status ?? "—"}</DetailItem>
          <DetailItem label="Resource" mono>
            {event.resource ?? "—"}
          </DetailItem>
          <DetailItem label="Action">{event.action ?? "—"}</DetailItem>
          <DetailItem label="User agent" mono>
            {event.userAgent ?? "—"}
          </DetailItem>
        </dl>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Message</h2>
        <p className="text-sm break-words text-foreground">{event.message}</p>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Metadata</h2>
        {metadataJson ? (
          <pre className="max-h-96 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-xs text-muted-foreground">
            {metadataJson}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No metadata recorded for this event.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
            Related alerts ({event.relatedAlerts.length})
          </h2>
          {event.relatedAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This event has not triggered any alerts.
            </p>
          ) : (
            <ul className="space-y-2">
              {event.relatedAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/alerts/${alert.id}`}
                    className="truncate text-sm text-primary hover:underline"
                  >
                    {alert.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Siren className="size-4 text-muted-foreground" aria-hidden="true" />
            Related incidents ({event.relatedIncidents.length})
          </h2>
          {event.relatedIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This event is not part of any incident.
            </p>
          ) : (
            <ul className="space-y-2">
              {event.relatedIncidents.map((incident) => (
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
  );
}
