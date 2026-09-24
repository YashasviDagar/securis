import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RuleFacets, RuleQuery } from "@/types/rules";
import { cn } from "@/lib/utils";

/**
 * Securis - Detection rule filters
 *
 * Server-rendered GET form (no client JavaScript).
 *
 * Connection: app/(soc)/detection-rules/page.tsx.
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

export function RuleFilters({ query, facets }: { query: RuleQuery; facets: RuleFacets }) {
  return (
    <form
      method="get"
      action="/detection-rules"
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
              placeholder="code, name, description…"
              defaultValue={query.search ?? ""}
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Severity">
          <Select name="severity" aria-label="Severity" defaultValue={query.severity[0] ?? ""}>
            <option value="">All severities</option>
            {facets.severities.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Rule type">
          <Select name="ruleType" aria-label="Rule type" defaultValue={query.ruleType[0] ?? ""}>
            <option value="">All rule types</option>
            {facets.ruleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            name="enabled"
            aria-label="Status"
            defaultValue={query.enabled === undefined ? "" : String(query.enabled)}
          >
            <option value="">Any status</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
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

        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit" size="sm" className="flex-1">
            <Filter className="size-3.5" aria-hidden="true" />
            Apply filters
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/detection-rules" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
