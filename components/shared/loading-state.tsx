import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Securis - LoadingState
 *
 * Standard "please wait" indicator used while data is being fetched. Pages also
 * ship `loading.tsx` files (Next.js Suspense boundaries) which reuse the
 * skeletons below so navigation feels instant.
 *
 * Connection: used by the `loading.tsx` files of the (soc) route group and by
 * client components that fetch data.
 */
export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * A shimmering placeholder block. Used to build table/card skeletons without
 * pulling in an extra dependency.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/70", className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton shaped like the page header (title + description). */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2 border-b border-border/60 pb-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Skeleton shaped like a table of security records. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
