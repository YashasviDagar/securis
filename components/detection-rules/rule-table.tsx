import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { RuleRowActions } from "@/components/detection-rules/rule-row-actions";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { buildRuleSortHref } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { RuleListItem, RuleQuery, RuleSortField } from "@/types/rules";

/**
 * Securis - Detection rule table
 *
 * Server component rendering one page of rules with sortable columns and
 * per-row actions.
 *
 * Connection: app/(soc)/detection-rules/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: RuleSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Rule code", sortKey: "code", className: "w-[210px]" },
  { label: "Name", sortKey: "name", className: "min-w-[200px]" },
  { label: "Type", sortKey: "ruleType", className: "w-[130px]" },
  { label: "Severity", sortKey: "severity", className: "w-[100px]" },
  { label: "Threshold", className: "w-[100px]" },
  { label: "Window", className: "w-[100px]" },
  { label: "Status", sortKey: "enabled", className: "w-[100px]" },
  { label: "Alerts", className: "w-[70px]" },
  { label: "Updated", sortKey: "updatedAt", className: "w-[190px]" },
  { label: "Actions", className: "w-[120px]" },
];

function SortHeader({ column, query }: { column: Column; query: RuleQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildRuleSortHref(query, column.sortKey!)}
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

/** Render a window in seconds as a human-readable duration. */
function formatWindow(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function RuleTable({
  rules,
  query,
  canWrite,
}: {
  rules: RuleListItem[];
  query: RuleQuery;
  canWrite: boolean;
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
          {rules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/detection-rules/${rule.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {rule.code}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/detection-rules/${rule.id}`}
                  className="line-clamp-1 font-medium text-foreground hover:underline"
                >
                  {rule.name}
                </Link>
                <p className="line-clamp-1 text-[0.68rem] text-muted-foreground">
                  {rule.description}
                </p>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{rule.ruleType}</td>
              <td className="px-3 py-2">
                <SeverityBadge severity={rule.severity} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {rule.threshold ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatWindow(rule.timeWindowSeconds)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium ring-1 ring-inset",
                    rule.enabled
                      ? "bg-severity-low/15 text-severity-low ring-severity-low/30"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {rule.alertCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(rule.updatedAt)}
              </td>
              <td className="px-3 py-2">
                <RuleRowActions rule={rule} canWrite={canWrite} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
