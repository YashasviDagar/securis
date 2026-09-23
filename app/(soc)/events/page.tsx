import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { EventFilters } from "@/components/events/event-filters";
import { EventTable } from "@/components/events/event-table";
import { Pagination } from "@/components/events/pagination";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/auth/current-user";
import { parseEventQuery } from "@/lib/validation/events";
import { getEventFacets, listEvents } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Events · Securis" };

/**
 * /events - Security event explorer.
 *
 * Server component. All filtering, sorting and pagination are performed by the
 * database through `listEvents`; the page renders only the current page of
 * rows. State lives entirely in the URL, so every view is shareable and works
 * without client-side JavaScript.
 *
 * Authorization: `requirePermission("events:read")` (ADMIN, SECURITY_ANALYST and
 * VIEWER all hold it).
 *
 * Connection: lib/validation/events.ts -> server/services/event-service.ts ->
 * components/events/**.
 */

// The explorer queries the database on every request; never prerender it.
export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("events:read");

  const params = await searchParams;
  const query = parseEventQuery(params);

  // Sequential queries: the local Prisma Postgres instance serves a single
  // connection, so issuing them one after another avoids contention.
  const result = await listEvents(query);
  const facets = await getEventFacets();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        description="Normalised security events collected from every source. Filter, search and drill into any record."
        actions={
          <span className="text-xs text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
        }
      />

      <EventFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No events match these filters"
          description="Adjust or clear the filters to see security events. New events appear here as soon as they are ingested."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/events">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <EventTable events={result.items} query={query} />
          <Pagination
            query={query}
            page={result.page}
            total={result.total}
            totalPages={result.totalPages}
          />
        </>
      )}
    </div>
  );
}
