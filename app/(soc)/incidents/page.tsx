import type { Metadata } from "next";
import Link from "next/link";
import { Siren } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { IncidentFilters } from "@/components/incidents/incident-filters";
import { IncidentTable } from "@/components/incidents/incident-table";
import { CreateIncidentDialog } from "@/components/incidents/create-incident-dialog";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseIncidentQuery } from "@/lib/validation/incidents";
import { buildIncidentsHref } from "@/lib/incidents";
import {
  getCandidateAlerts,
  getIncidentFacets,
  listIncidents,
} from "@/server/services/incident-service";
import { getAssignableUsers } from "@/server/services/user-service";

export const metadata: Metadata = { title: "Incidents · Securis" };

/**
 * /incidents - Incident response board.
 *
 * Server component. Filtering, sorting and pagination run in the database; the
 * URL holds the entire view state. Analysts can bundle alerts into a new
 * incident from the header dialog.
 *
 * Authorization: `requirePermission("incidents:read")`; the create dialog is
 * only rendered when the role holds `incidents:write`, and the API re-checks it.
 *
 * Connection: lib/validation/incidents.ts -> server/services/incident-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("incidents:read");

  const params = await searchParams;
  const query = parseIncidentQuery(params);

  const result = await listIncidents(query);
  const facets = await getIncidentFacets();
  const canWrite = hasPermission(session.user.role, "incidents:write");

  // Only load dialog data for users who can actually create incidents.
  const [candidateAlerts, users] = canWrite
    ? await Promise.all([getCandidateAlerts(), getAssignableUsers()])
    : [[], []];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description="Coordinated investigations built from related alerts."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </span>
            <CreateIncidentDialog
              candidateAlerts={candidateAlerts}
              users={users}
              canWrite={canWrite}
            />
          </div>
        }
      />

      <IncidentFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={Siren}
          title="No incidents match these filters"
          description="Create an incident from related alerts, or clear the filters to see the full board."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/incidents">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <IncidentTable incidents={result.items} query={query} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildIncidentsHref(query, { page })}
            label="incidents"
          />
        </>
      )}
    </div>
  );
}
