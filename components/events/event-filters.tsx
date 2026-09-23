import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEVERITIES, SOURCE_TYPES } from "@/types/security";
import type { EventFacets, EventQuery } from "@/types/events";
import { formatDateInput } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Securis - Event filters
 *
 * A server-rendered `<form method="get">`. Submitting it performs a normal
 * navigation to `/events?...`, so filtering happens entirely on the server and
 * works without client-side JavaScript. Every field reflects the current query.
 *
 * The form deliberately omits a `page` field so applying a new filter resets
 * pagination to page 1. `sortBy`/`sortDir` are carried as hidden inputs so
 * filtering preserves the current sort order.
 *
 * Connection: app/(soc)/events/page.tsx (parses the resulting query).
 */

/** Styled native select (server-friendly; no Radix required). */
function Select({
  name,
  defaultValue,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      aria-label={ariaLabel}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** A labelled filter field. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export function EventFilters({
  query,
  facets,
}: {
  query: EventQuery;
  facets: EventFacets;
}) {
  return (
    <form
      method="get"
      action="/events"
      className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
    >
      {/* Preserve the current sort order across filter submissions. */}
      <input type="hidden" name="sortBy" value={query.sortBy} />
      <input type="hidden" name="sortDir" value={query.sortDir} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="search"
              type="search"
              placeholder="message, user, IP, resource…"
              defaultValue={query.search ?? ""}
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Severity">
          <Select name="severity" aria-label="Severity" defaultValue={query.severity[0] ?? ""}>
            <option value="">All severities</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Source type">
          <Select name="sourceType" aria-label="Source type" defaultValue={query.sourceType ?? ""}>
            <option value="">All source types</option>
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Source">
          <Select name="source" aria-label="Source" defaultValue={query.source ?? ""}>
            <option value="">All sources</option>
            {facets.sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Event type">
          <Select name="eventType" aria-label="Event type" defaultValue={query.eventType ?? ""}>
            <option value="">All event types</option>
            {facets.eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select name="status" aria-label="Status" defaultValue={query.status ?? ""}>
            <option value="">All statuses</option>
            {facets.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Username">
          <Input name="username" placeholder="e.g. admin" defaultValue={query.username ?? ""} />
        </Field>

        <Field label="Source IP">
          <Input name="sourceIp" placeholder="e.g. 192.168.1.50" defaultValue={query.sourceIp ?? ""} />
        </Field>

        <Field label="From date">
          <Input name="from" type="date" defaultValue={formatDateInput(query.from)} />
        </Field>

        <Field label="To date">
          <Input name="to" type="date" defaultValue={formatDateInput(query.to)} />
        </Field>

        <Field label="Page size">
          <Select name="pageSize" aria-label="Page size" defaultValue={String(query.pageSize)}>
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="flex-1">
            <Filter className="size-3.5" aria-hidden="true" />
            Apply
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/events" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
