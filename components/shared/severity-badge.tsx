import { cn } from "@/lib/utils";
import type { AlertStatus, IncidentStatus, Severity } from "@/types/security";

/**
 * Securis - SeverityBadge
 *
 * Renders a severity using the dedicated severity colour tokens defined in
 * app/globals.css, so a given severity always looks the same everywhere in the
 * console (events, alerts, incidents, rules, dashboard).
 *
 * Connection: used by the event table/detail and, in later phases, alerts,
 * incidents and the dashboard.
 */
const SEVERITY_STYLES: Record<Severity, string> = {
  INFO: "bg-severity-info/15 text-severity-info ring-severity-info/30",
  LOW: "bg-severity-low/15 text-severity-low ring-severity-low/30",
  MEDIUM: "bg-severity-medium/15 text-severity-medium ring-severity-medium/30",
  HIGH: "bg-severity-high/15 text-severity-high ring-severity-high/30",
  CRITICAL: "bg-severity-critical/15 text-severity-critical ring-severity-critical/30",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium tracking-wide ring-1 ring-inset",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}

/**
 * Securis - StatusBadge
 *
 * Neutral badge for lifecycle statuses (alert/incident). Colour is derived from
 * the status so "open"-like states read differently from "closed"-like states.
 */
const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-primary/15 text-primary ring-primary/30",
  OPEN: "bg-primary/15 text-primary ring-primary/30",
  INVESTIGATING: "bg-severity-medium/15 text-severity-medium ring-severity-medium/30",
  CONTAINED: "bg-severity-info/15 text-severity-info ring-severity-info/30",
  RESOLVED: "bg-severity-low/15 text-severity-low ring-severity-low/30",
  CLOSED: "bg-muted text-muted-foreground ring-border",
  FALSE_POSITIVE: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AlertStatus | IncidentStatus | string;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium tracking-wide ring-1 ring-inset",
        style,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
