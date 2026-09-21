import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Securis - EmptyState
 *
 * Rendered whenever a list, table or module has nothing to display. Every
 * module in Securis must handle three visual states: loading, empty and error.
 * This component is the canonical empty state.
 *
 * Important project rule: an empty state must never be filled with fabricated
 * data. When a module is not built yet it states so explicitly (see
 * `ModuleScaffold`).
 *
 * Connection: used by every data-driven page under app/(soc)/**.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  /** Lucide icon shown in the circular badge. */
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional call to action (e.g. a link or button). */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
