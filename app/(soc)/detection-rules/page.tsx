import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { RuleFilters } from "@/components/detection-rules/rule-filters";
import { RuleTable } from "@/components/detection-rules/rule-table";
import { RuleFormDialog } from "@/components/detection-rules/rule-form-dialog";
import { requirePermission } from "@/auth/current-user";
import { parseRuleQuery } from "@/lib/validation/rules";
import { buildRulesHref } from "@/lib/rules";
import { getRuleFacets, listRules } from "@/server/services/rule-service";

export const metadata: Metadata = { title: "Detection Rules · Securis" };

/**
 * /detection-rules - Detection rule management.
 *
 * Server component. Administrators can create, edit, enable/disable and delete
 * the rules the detection engine evaluates. Because rules are stored in the
 * database, changes take effect on the next detection run.
 *
 * Authorization: `requirePermission("rules:write")` (administrator only).
 *
 * Connection: lib/validation/rules.ts -> server/services/rule-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function DetectionRulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("rules:write");

  const params = await searchParams;
  const query = parseRuleQuery(params);

  const result = await listRules(query);
  const facets = await getRuleFacets();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detection Rules"
        description="Rules the detection engine evaluates against every event. Rules are data — no deployment required."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </span>
            <RuleFormDialog
              canWrite
              trigger={
                <Button size="sm">
                  <Plus className="size-3.5" aria-hidden="true" />
                  New rule
                </Button>
              }
            />
          </div>
        }
      />

      <RuleFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No rules match these filters"
          description="Create a rule or clear the filters. Enabled rules are evaluated by the detection engine on the next run."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/detection-rules">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <RuleTable rules={result.items} query={query} canWrite />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildRulesHref(query, { page })}
            label="rules"
          />
        </>
      )}
    </div>
  );
}
