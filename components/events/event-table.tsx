import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { buildSortHref } from "@/lib/events";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { EventListItem, EventQuery, EventSortField } from "@/types/events";

/**
 * Securis - Event table
 *
 * Server component that renders one page of events. Sortable columns are plain
 * links that toggle the sort direction via the URL, so sorting is performed by
 * the database rather than in the browser.
 *
 * Each row links to the event detail page. Only the current page's rows are
 * rendered - the browser never receives the full event set.
 *
 * Connection: app/(soc)/events/page.tsx (data), lib/events.ts (URL building).
 */

interface Column {
  label: string;
  sortKey?: EventSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Timestamp", sortKey: "timestamp", className: "w-[190px]" },
  { label: "Severity", sortKey: "severity", className: "w-[100px]" },
  { label: "Event type", sortKey: "eventType", className: "w-[170px]" },
  { label: "Source", sortKey: "source", className: "w-[170px]" },
  { label: "Username", className: "w-[120px]" },
  { label: "Source IP", className: "w-[130px]" },
  { label: "Status", className: "w-[100px]" },
  { label: "Message" },
];

/** Sortable column header; clicking toggles asc/desc. */
function SortHeader({ column, query }: { column: Column; query: EventQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildSortHref(query, column.sortKey!)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        isActive && "text-foreground",
      )}
      aria-label={`Sort by ${column.label}`}
    >
      {column.label}
      {isActive ? (
        query.sortDir === "asc" ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )
      ) : null}
    </Link>
  );
}

export function EventTable({
  events,
  query,
}: {
  events: EventListItem[];
  query: EventQuery;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            {COLUMNS.map((column) => (
              <th key={column.label} className={cn("px-3 py-2 font-medium", column.className)}>
                {column.sortKey ? (
                  <SortHeader column={column} query={query} />
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/events/${event.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {formatDateTime(event.timestamp)}
                </Link>
              </td>
              <td className="px-3 py-2">
                <SeverityBadge severity={event.severity} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-foreground">{event.eventType}</td>
              <td className="px-3 py-2 text-muted-foreground">{event.source}</td>
              <td className="px-3 py-2 text-muted-foreground">{event.username ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {event.sourceIp ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{event.status ?? "—"}</td>
              <td className="max-w-[420px] truncate px-3 py-2 text-foreground" title={event.message}>
                {event.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
