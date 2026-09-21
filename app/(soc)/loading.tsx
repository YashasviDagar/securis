import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-state";

/**
 * Securis - Console loading boundary
 *
 * Next.js renders this automatically (via React Suspense) while a route inside
 * the (soc) group is loading. It mirrors the real page shape - header plus a
 * data table - so navigation does not cause layout jumps.
 *
 * Connection: applies to every route under app/(soc)/**.
 */
export default function SocLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} />
    </div>
  );
}
