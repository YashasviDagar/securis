import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { buildEventsHref } from "@/lib/events";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";
import type { EventQuery } from "@/types/events";

/**
 * Securis - Pagination
 *
 * Server component pagination controls. Every control is a link that changes
 * only the `page` query parameter, so navigation is a normal server request and
 * works without client JavaScript.
 *
 * Connection: app/(soc)/events/page.tsx.
 */

/** Compute the visible page numbers, inserting gaps for long ranges. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const current of sorted) {
    if (previous && current - previous > 1) result.push("gap");
    result.push(current);
    previous = current;
  }
  return result;
}

export function Pagination({
  query,
  total,
  totalPages,
  page,
}: {
  query: EventQuery;
  total: number;
  totalPages: number;
  page: number;
}) {
  const start = total === 0 ? 0 : (page - 1) * query.pageSize + 1;
  const end = Math.min(page * query.pageSize, total);
  const pages = pageWindow(page, totalPages);

  const navClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2");

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{formatNumber(start)}</span>–
        <span className="font-medium text-foreground">{formatNumber(end)}</span> of{" "}
        <span className="font-medium text-foreground">{formatNumber(total)}</span> events
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        {page > 1 ? (
          <Link
            href={buildEventsHref(query, { page: page - 1 })}
            className={navClass}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Prev
          </Link>
        ) : (
          <span className={cn(navClass, "pointer-events-none opacity-40")}>
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Prev
          </span>
        )}

        {pages.map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={buildEventsHref(query, { page: entry })}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs transition-colors",
                entry === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {entry}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={buildEventsHref(query, { page: page + 1 })}
            className={navClass}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className={cn(navClass, "pointer-events-none opacity-40")}>
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </nav>
    </div>
  );
}
