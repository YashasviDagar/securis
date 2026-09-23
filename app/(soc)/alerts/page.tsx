import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { AlertFilters } from "@/components/alerts/alert-filters";
import { AlertTable } from "@/components/alerts/alert-table";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/auth/current-user";
import { parseAlertQuery } from "@/lib/validation/alerts";
import { buildAlertsHref } from "@/lib/alerts";
import { getAlertFacets, listAlerts } from "@/server/services/alert-service";

export const metadata: Metadata = { title: "Alerts · Securis" };

/**
 * /alerts - Alert queue.
 *
 * Server component. Filtering, sorting and pagination all run in the database;
 * the URL holds the entire view state, so every view is shareable and works
 * without client JavaScript.
 *
 * Authorization: `requirePermission("alerts:read")` (all roles hold it; writes
 * are gated separately by `alerts:write`).
 *
 * Connection: lib/validation/alerts.ts -> server/services/alert-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("alerts:read");

  const params = await searchParams;
  const query = parseAlertQuery(params);

  const result = await listAlerts(query);
  const facets = await getAlertFacets();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alerts"
        description="Detections raised by the detection engine. Triage, assign and investigate."
        actions={
          <span className="text-xs text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
        }
      />

      <AlertFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No alerts match these filters"
          description="Adjust or clear the filters. New detections appear here as soon as the detection engine fires."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/alerts">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <AlertTable alerts={result.items} query={query} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildAlertsHref(query, { page })}
            label="alerts"
          />
        </>
      )}
    </div>
  );
}
