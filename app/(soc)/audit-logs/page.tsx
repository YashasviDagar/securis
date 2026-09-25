import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { requirePermission } from "@/auth/current-user";
import { parseAuditQuery } from "@/lib/validation/audit";
import { buildAuditHref } from "@/lib/audit";
import { getAuditFacets, listAudits } from "@/server/services/audit-service";

export const metadata: Metadata = { title: "Audit Logs · Securis" };

/**
 * /audit-logs - Append-only audit trail.
 *
 * Server component. Administrators can search and filter every privileged
 * action recorded since Phase 3. The trail is read-only: there is no way to
 * edit or delete an audit entry.
 *
 * Authorization: `requirePermission("audit:read")` (administrator only).
 *
 * Connection: lib/validation/audit.ts -> server/services/audit-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit:read");

  const params = await searchParams;
  const query = parseAuditQuery(params);

  const result = await listAudits(query);
  const facets = await getAuditFacets();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of every privileged action: authentication, user and role changes, alert and incident updates, rule changes and threat-intelligence edits."
        actions={
          <span className="text-xs text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
        }
      />

      <AuditFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries match these filters"
          description="Clear the filters to see the full trail. Entries are written automatically as actions are performed."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/audit-logs">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <AuditTable entries={result.items} query={query} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildAuditHref(query, { page })}
            label="audit entries"
          />
        </>
      )}
    </div>
  );
}
