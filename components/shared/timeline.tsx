import Link from "next/link";
import { Activity, MessageSquare } from "lucide-react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { formatDateTime } from "@/utils/format";
import type { EventListItem } from "@/types/events";

/**
 * Securis - Investigation timeline (generic)
 *
 * Merges analyst notes and related security events into one chronological view:
 * what the system observed, and what the analyst did about it. Shared by the
 * alert and incident detail pages.
 *
 * Connection: server/services/alert-service.ts and incident-service.ts supply
 * the notes and events.
 */

/** The minimal note shape the timeline needs (alert and incident notes both fit). */
export interface TimelineNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}

type TimelineEntry =
  | { kind: "note"; at: Date; note: TimelineNote }
  | { kind: "event"; at: Date; event: EventListItem };

export function Timeline({
  notes,
  events,
}: {
  notes: TimelineNote[];
  events: EventListItem[];
}) {
  const entries: TimelineEntry[] = [
    ...notes.map((note) => ({ kind: "note" as const, at: note.createdAt, note })),
    ...events.map((event) => ({ kind: "event" as const, at: event.timestamp, event })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline entries yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border/60 pl-5">
      {entries.map((entry) =>
        entry.kind === "note" ? (
          <li key={`note-${entry.note.id}`} className="relative">
            <span className="absolute top-1 -left-[26px] flex size-4 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40">
              <MessageSquare className="size-2.5 text-primary" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  Note by {entry.note.authorName}
                </span>
                <span className="font-mono text-[0.68rem] text-muted-foreground">
                  {formatDateTime(entry.at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{entry.note.body}</p>
            </div>
          </li>
        ) : (
          <li key={`event-${entry.event.id}`} className="relative">
            <span className="absolute top-1 -left-[26px] flex size-4 items-center justify-center rounded-full bg-muted ring-1 ring-border">
              <Activity className="size-2.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/events/${entry.event.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {entry.event.eventType}
                </Link>
                <SeverityBadge severity={entry.event.severity} />
                <span className="font-mono text-[0.68rem] text-muted-foreground">
                  {formatDateTime(entry.at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {entry.event.message}
                {entry.event.sourceIp ? (
                  <span className="ml-1 font-mono text-[0.7rem]">({entry.event.sourceIp})</span>
                ) : null}
              </p>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
