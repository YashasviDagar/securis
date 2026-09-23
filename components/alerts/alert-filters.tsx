import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALERT_STATUSES, SEVERITIES } from "@/types/security";
import type { AlertFacets, AlertQuery } from "@/types/alerts";
import { formatDateInput } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Securis - Alert filters
 *
 * Server-rendered `<form method="get">` (no client JavaScript required).
 * Submitting navigates to `/alerts?...`, so filtering happens on the server and
 * the view is shareable. `page` is omitted so a new filter resets to page 1;
 * `sortBy`/`sortDir` are carried as hidden inputs.
 *
 * Connection: app/(soc)/alerts/page.tsx.
 */

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

export function AlertFilters({
  query,
  facets,
}: {
  query: AlertQuery;
  facets: AlertFacets;
}) {
  return (
    <form
      method="get"
      action="/alerts"
      className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
    >
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
              placeholder="title, IP, user…"
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

        <Field label="Status">
          <Select name="status" aria-label="Status" defaultValue={query.status[0] ?? ""}>
            <option value="">All statuses</option>
            {ALERT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Detection rule">
          <Select name="ruleCode" aria-label="Detection rule" defaultValue={query.ruleCode ?? ""}>
            <option value="">All rules</option>
            {facets.rules.map((rule) => (
              <option key={rule.code} value={rule.code}>
                {rule.code}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Source IP">
          <Input name="sourceIp" placeholder="e.g. 198.51.100.23" defaultValue={query.sourceIp ?? ""} />
        </Field>

        <Field label="Target user">
          <Input name="targetUser" placeholder="e.g. admin" defaultValue={query.targetUser ?? ""} />
        </Field>

        <Field label="Assignment">
          <Select name="assigned" aria-label="Assignment" defaultValue={query.assigned ?? ""}>
            <option value="">Any assignment</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </Select>
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

        <Field label="Created from">
          <Input name="from" type="date" defaultValue={formatDateInput(query.from)} />
        </Field>

        <Field label="Created to">
          <Input name="to" type="date" defaultValue={formatDateInput(query.to)} />
        </Field>

        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit" size="sm" className="flex-1">
            <Filter className="size-3.5" aria-hidden="true" />
            Apply filters
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/alerts" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
