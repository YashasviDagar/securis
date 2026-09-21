"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Securis - ErrorState
 *
 * Standard error panel. It is a client component because it exposes a "Try
 * again" button wired to Next.js' error boundary `reset()` callback.
 *
 * Security note: this component only ever displays the *safe* message supplied
 * by the caller. Internal error details (stack traces, database messages) are
 * never rendered to the user - the full error is logged server-side instead
 * (Phase 18).
 *
 * Connection: used by app/error.tsx and app/(soc)/error.tsx.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this module. The issue has been logged.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  /** Typically the `reset` function provided by a Next.js error boundary. */
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
