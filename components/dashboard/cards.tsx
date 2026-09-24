import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";

/**
 * Securis - Dashboard cards
 *
 * Small presentational components shared by the dashboard: a headline stat card
 * and a titled chart container. Both are server components.
 */

/** A single headline metric. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  emphasis,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  /** Visual emphasis for metrics that warrant attention. */
  emphasis?: "default" | "warning" | "critical";
}) {
  const emphasisClass =
    emphasis === "critical"
      ? "text-severity-critical"
      : emphasis === "warning"
        ? "text-severity-high"
        : "text-primary";

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className={cn("size-4", emphasisClass)} aria-hidden="true" />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint ? <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A titled container for a chart. */
export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card/40 p-4", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description ? (
          <p className="text-[0.68rem] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
