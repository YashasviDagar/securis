import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INCIDENT_STATUSES, SEVERITIES } from "@/types/security";
import type { IncidentFacets, IncidentQuery } from "@/types/incidents";
import { formatDateInput } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Securis - Incident filters
 *
 * Server-rendered GET form (no client JavaScript). Submitting navigates to
 * `/incidents?...`; `page` is omitted so a new filter resets to page 1 and the
 * sort is carried through hidden inputs.
 *
 * Connection: app/(soc)/incidents/page.tsx.
 */

function Select({
  name,
  defaultValue,
  children,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      aria-label={ariaLabel}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
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

export function IncidentFilters({
  query,
  facets,
}: {
  query: IncidentQuery;
  facets: IncidentFacets;
}) {
  return (
    <form
      method="get"
      action="/incidents"
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
              placeholder="reference, title…"
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
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Assigned analyst">
          <Select name="assignedToId" aria-label="Assigned analyst" defaultValue={query.assignedToId ?? ""}>
            <option value="">Any analyst</option>
            {facets.analysts.map((analyst) => (
              <option key={analyst.id} value={analyst.id}>
                {analyst.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Assignment">
          <Select name="assigned" aria-label="Assignment" defaultValue={query.assigned ?? ""}>
            <option value="">Any assignment</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </Select>
        </Field>

        <Field label="Created from">
          <Input name="from" type="date" defaultValue={formatDateInput(query.from)} />
        </Field>

        <Field label="Created to">
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

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm">
            <Filter className="size-3.5" aria-hidden="true" />
            Apply filters
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/incidents" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
