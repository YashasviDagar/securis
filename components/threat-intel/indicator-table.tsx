import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { IndicatorRowActions } from "@/components/threat-intel/indicator-row-actions";
import { buildIndicatorSortHref } from "@/lib/threat-intel";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type {
  IndicatorListItem,
  IndicatorQuery,
  IndicatorSortField,
} from "@/types/threat-intel";

/**
 * Securis - Indicator table
 *
 * Server component rendering one page of threat indicators with sortable
 * columns and per-row actions.
 *
 * Connection: app/(soc)/threat-intelligence/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: IndicatorSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Type", className: "w-[90px]" },
  { label: "Value", sortKey: "value", className: "min-w-[240px]" },
  { label: "Threat type", className: "w-[150px]" },
  { label: "Confidence", sortKey: "confidence", className: "w-[130px]" },
  { label: "Source", className: "w-[140px]" },
  { label: "First seen", sortKey: "firstSeen", className: "w-[190px]" },
  { label: "Last seen", sortKey: "lastSeen", className: "w-[190px]" },
  { label: "Status", className: "w-[90px]" },
  { label: "Actions", className: "w-[120px]" },
];

function SortHeader({ column, query }: { column: Column; query: IndicatorQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildIndicatorSortHref(query, column.sortKey!)}
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

/** Colour the confidence value by its band. */
function confidenceClass(confidence: number): string {
  if (confidence >= 80) return "text-severity-critical";
  if (confidence >= 60) return "text-severity-high";
  if (confidence >= 40) return "text-severity-medium";
  return "text-muted-foreground";
}

export function IndicatorTable({
  indicators,
  query,
  canWrite,
}: {
  indicators: IndicatorListItem[];
  query: IndicatorQuery;
  canWrite: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
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
          {indicators.map((indicator) => (
            <tr
              key={indicator.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] text-foreground">
                  {indicator.type}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs break-all text-foreground" title={indicator.value}>
                  {indicator.value}
                </span>
                {indicator.description ? (
                  <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-muted-foreground">
                    {indicator.description}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{indicator.threatType ?? "—"}</td>
              <td className="px-3 py-2">
                <span className={cn("font-mono text-xs", confidenceClass(indicator.confidence))}>
                  {indicator.confidence}
                </span>
                <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${indicator.confidence}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{indicator.source}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(indicator.firstSeen)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(indicator.lastSeen)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium ring-1 ring-inset",
                    indicator.active
                      ? "bg-severity-low/15 text-severity-low ring-severity-low/30"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {indicator.active ? "Active" : "Retired"}
                </span>
              </td>
              <td className="px-3 py-2">
                <IndicatorRowActions indicator={indicator} canWrite={canWrite} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
