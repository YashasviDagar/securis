import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { IndicatorFilters } from "@/components/threat-intel/indicator-filters";
import { IndicatorTable } from "@/components/threat-intel/indicator-table";
import { IndicatorFormDialog } from "@/components/threat-intel/indicator-form-dialog";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseIndicatorQuery } from "@/lib/validation/threat-intel";
import { buildIndicatorsHref } from "@/lib/threat-intel";
import {
  getIndicatorFacets,
  listIndicators,
} from "@/server/threat-intel";

export const metadata: Metadata = { title: "Threat Intelligence · Securis" };

/**
 * /threat-intelligence - Local indicator database.
 *
 * Server component. Indicators can be searched, filtered, added, edited,
 * retired and deleted. Active indicators feed the risk engine: when an event's
 * source IP matches one, the resulting alert's risk score is raised.
 *
 * Authorization: `threat-intel:read` to view; `threat-intel:write` to modify
 * (enforced by the API; the add/edit controls are only rendered for writers).
 *
 * Connection: lib/validation/threat-intel.ts -> server/threat-intel.
 */

export const dynamic = "force-dynamic";

export default async function ThreatIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("threat-intel:read");

  const params = await searchParams;
  const query = parseIndicatorQuery(params);

  const result = await listIndicators(query);
  const facets = await getIndicatorFacets();
  const canWrite = hasPermission(session.user.role, "threat-intel:write");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Threat Intelligence"
        description="Local indicators (IPs, domains, hashes and URLs). Active matches raise an alert's risk score."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </span>
            <IndicatorFormDialog
              canWrite={canWrite}
              trigger={
                <Button size="sm">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add indicator
                </Button>
              }
            />
          </div>
        }
      />

      <IndicatorFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="No indicators match these filters"
          description="Add an indicator or clear the filters. Active indicators are consulted by the risk engine during detection."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/threat-intelligence">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <IndicatorTable indicators={result.items} query={query} canWrite={canWrite} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildIndicatorsHref(query, { page })}
            label="indicators"
          />
        </>
      )}
    </div>
  );
}
