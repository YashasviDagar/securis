import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserFacets, UserQuery } from "@/types/users";
import { cn } from "@/lib/utils";

/**
 * Securis - User filters
 *
 * Server-rendered GET form.
 *
 * Connection: app/(soc)/users/page.tsx.
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

export function UserFilters({ query, facets }: { query: UserQuery; facets: UserFacets }) {
  return (
    <form
      method="get"
      action="/users"
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
              placeholder="name or email…"
              defaultValue={query.search ?? ""}
              className="pl-7"
            />
          </div>
        </Field>

        <Field label="Role">
          <Select name="role" aria-label="Role" defaultValue={query.role[0] ?? ""}>
            <option value="">All roles</option>
            {facets.roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            name="active"
            aria-label="Status"
            defaultValue={query.active === undefined ? "" : String(query.active)}
          >
            <option value="">Any status</option>
            <option value="true">Active</option>
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
            <Link href="/users" aria-label="Clear filters">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
