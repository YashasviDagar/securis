import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { buildAuditSortHref } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { AuditListItem, AuditQuery, AuditSortField } from "@/types/audit";

/**
 * Securis - Audit table
 *
 * Server component rendering one page of the append-only audit trail. Each row
 * can expand to reveal the entry's metadata.
 *
 * Connection: app/(soc)/audit-logs/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: AuditSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Timestamp", sortKey: "createdAt", className: "w-[190px]" },
  { label: "Actor", sortKey: "actorEmail", className: "w-[210px]" },
  { label: "Action", sortKey: "action", className: "w-[220px]" },
  { label: "Target", className: "min-w-[200px]" },
  { label: "IP", className: "w-[130px]" },
  { label: "Metadata" },
];

/** Colour an action by its nature (destructive/failure vs normal). */
function actionClass(action: string): string {
  if (/(FAILED|DELETED|DISABLED|REVOKED|EXPIRED)/.test(action)) {
    return "bg-severity-high/15 text-severity-high ring-severity-high/30";
  }
  if (/(CREATED|ENABLED|SUCCESS|ADDED|RESOLVED)/.test(action)) {
    return "bg-severity-low/15 text-severity-low ring-severity-low/30";
  }
  return "bg-muted text-muted-foreground ring-border";
}

function SortHeader({ column, query }: { column: Column; query: AuditQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildAuditSortHref(query, column.sortKey!)}
      className={cn("inline-flex items-center gap-1 hover:text-foreground", isActive && "text-foreground")}
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

/** Render metadata as compact JSON, or an em dash. */
function metadataText(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "—";
  try {
    return JSON.stringify(metadata);
  } catch {
    return "—";
  }
}

export function AuditTable({ entries, query }: { entries: AuditListItem[]; query: AuditQuery }) {
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
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-border/40 align-top transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </td>
              <td className="px-3 py-2">
                <span className="text-sm text-foreground">{entry.actorName ?? "—"}</span>
                <p className="font-mono text-[0.68rem] text-muted-foreground">
                  {entry.actorEmail ?? "—"}
                </p>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] ring-1 ring-inset",
                    actionClass(entry.action),
                  )}
                >
                  {entry.action}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="text-xs text-foreground">{entry.targetLabel ?? "—"}</span>
                {entry.targetType ? (
                  <p className="font-mono text-[0.68rem] text-muted-foreground">
                    {entry.targetType}
                    {entry.targetId ? ` · ${entry.targetId}` : ""}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {entry.ipAddress ?? "—"}
              </td>
              <td className="max-w-[320px] px-3 py-2">
                {entry.metadata ? (
                  <details>
                    <summary className="cursor-pointer text-[0.68rem] text-muted-foreground hover:text-foreground">
                      view
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/60 p-2 font-mono text-[0.65rem] break-all whitespace-pre-wrap text-muted-foreground">
                      {metadataText(entry.metadata)}
                    </pre>
                  </details>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
