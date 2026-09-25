import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditFacets, AuditQuery } from "@/types/audit";
import { formatDateInput } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Securis - Audit filters
 *
 * Server-rendered GET form (no client JavaScript).
 *
 * Connection: app/(soc)/audit-logs/page.tsx.
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

export function AuditFilters({ query, facets }: { query: AuditQuery; facets: AuditFacets }) {
  return (
    <form
      method="get"
      action="/audit-logs"
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
              placeholder="actor, target, IP, action…"
              defaultValue={query.search ?? ""}
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Action">
          <Select name="action" aria-label="Action" defaultValue={query.action ?? ""}>
            <option value="">All actions</option>
            {facets.actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Actor">
          <Select name="actorEmail" aria-label="Actor" defaultValue={query.actorEmail ?? ""}>
            <option value="">All actors</option>
            {facets.actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Target type">
          <Select name="targetType" aria-label="Target type" defaultValue={query.targetType ?? ""}>
            <option value="">All target types</option>
            {facets.targetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="IP address">
          <Input name="ipAddress" placeholder="e.g. 127.0.0.1" defaultValue={query.ipAddress ?? ""} />
        </Field>

        <Field label="From">
          <Input name="from" type="date" defaultValue={formatDateInput(query.from)} />
        </Field>

        <Field label="To">
          <Input name="to" type="date" defaultValue={formatDateInput(query.to)} />
        </Field>

        <Field label="Page size">
          <Select name="pageSize" aria-label="Page size" defaultValue={String(query.pageSize)}>
            {[50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit" size="sm" className="flex-1">
            <Filter className="size-3.5" aria-hidden="true" />
            Apply filters
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/audit-logs" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
