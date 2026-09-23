import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { RiskScoreBadge } from "@/components/shared/risk-badge";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { buildAlertSortHref } from "@/lib/alerts";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { AlertListItem, AlertQuery, AlertSortField } from "@/types/alerts";

/**
 * Securis - Alert queue table
 *
 * Server component rendering one page of alerts. Sortable columns are links
 * that toggle the sort direction via the URL, so ordering is done by the
 * database. Each row links to the alert detail page.
 *
 * Connection: app/(soc)/alerts/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: AlertSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Alert", className: "min-w-[260px]" },
  { label: "Severity", sortKey: "severity", className: "w-[100px]" },
  { label: "Risk", sortKey: "riskScore", className: "w-[130px]" },
  { label: "Status", sortKey: "status", className: "w-[120px]" },
  { label: "Rule", className: "w-[200px]" },
  { label: "Source IP", className: "w-[130px]" },
  { label: "Target", className: "w-[110px]" },
  { label: "Assignee", className: "w-[150px]" },
  { label: "Events", className: "w-[70px]" },
  { label: "Created", sortKey: "createdAt", className: "w-[190px]" },
];

function SortHeader({ column, query }: { column: Column; query: AlertQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildAlertSortHref(query, column.sortKey!)}
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

export function AlertTable({
  alerts,
  query,
}: {
  alerts: AlertListItem[];
  query: AlertQuery;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1200px] border-collapse text-sm">
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
          {alerts.map((alert) => (
            <tr
              key={alert.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/alerts/${alert.id}`}
                  className="line-clamp-1 font-medium text-primary hover:underline"
                >
                  {alert.title}
                </Link>
                <span className="text-[0.68rem] text-muted-foreground">
                  {alert.noteCount > 0 ? `${alert.noteCount} note${alert.noteCount > 1 ? "s" : ""}` : ""}
                </span>
              </td>
              <td className="px-3 py-2">
                <SeverityBadge severity={alert.severity} />
              </td>
              <td className="px-3 py-2">
                <RiskScoreBadge score={alert.riskScore} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={alert.status} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {alert.ruleCode ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {alert.sourceIp ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{alert.targetUser ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {alert.assignedTo ? alert.assignedTo.name : "Unassigned"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {alert.eventCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(alert.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
