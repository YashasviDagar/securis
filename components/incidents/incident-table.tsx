import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { buildIncidentSortHref } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { IncidentListItem, IncidentQuery, IncidentSortField } from "@/types/incidents";

/**
 * Securis - Incident board table
 *
 * Server component rendering one page of incidents with sortable columns and a
 * link to each incident's detail page.
 *
 * Connection: app/(soc)/incidents/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: IncidentSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Reference", sortKey: "reference", className: "w-[140px]" },
  { label: "Title", className: "min-w-[240px]" },
  { label: "Severity", sortKey: "severity", className: "w-[100px]" },
  { label: "Status", sortKey: "status", className: "w-[130px]" },
  { label: "Assignee", className: "w-[150px]" },
  { label: "Alerts", className: "w-[70px]" },
  { label: "Events", className: "w-[70px]" },
  { label: "Notes", className: "w-[70px]" },
  { label: "Created", sortKey: "createdAt", className: "w-[190px]" },
  { label: "Updated", sortKey: "updatedAt", className: "w-[190px]" },
];

function SortHeader({ column, query }: { column: Column; query: IncidentQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildIncidentSortHref(query, column.sortKey!)}
      className={cn("inline-flex items-center gap-1 hover:text-foreground", isActive && "text-foreground")}
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

export function IncidentTable({
  incidents,
  query,
}: {
  incidents: IncidentListItem[];
  query: IncidentQuery;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1150px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            {COLUMNS.map((column) => (
              <th key={column.label} className={cn("px-3 py-2 font-medium", column.className)}>
                {column.sortKey ? <SortHeader column={column} query={query} /> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr
              key={incident.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/incidents/${incident.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {incident.reference}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/incidents/${incident.id}`}
                  className="line-clamp-1 font-medium text-foreground hover:underline"
                >
                  {incident.title}
                </Link>
              </td>
              <td className="px-3 py-2">
                <SeverityBadge severity={incident.severity} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={incident.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {incident.assignedTo ? incident.assignedTo.name : "Unassigned"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {incident.alertCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {incident.eventCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {incident.noteCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(incident.createdAt)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(incident.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
