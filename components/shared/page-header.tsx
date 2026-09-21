import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Securis - PageHeader
 *
 * A reusable page title block rendered at the top of every SOC screen. It keeps
 * typography and spacing consistent across all modules and provides a slot for
 * page-level actions (filters, buttons, exports).
 *
 * This is a server component by default: it renders no state and no event
 * handlers, so it can be used from both server and client pages.
 *
 * Connection: used by every page under app/(soc)/**.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Optional right-aligned controls (filters, buttons). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
