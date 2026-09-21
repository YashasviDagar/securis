import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Securis - ModuleScaffold
 *
 * Renders the shell of a SOC module that has not been implemented yet. Securis
 * is built phase-by-phase, so during early phases many routes exist (routing,
 * layout and navigation are real) while their functionality lands later.
 *
 * This component exists to satisfy two project rules:
 *   1. "Do not create fake buttons" - there is no interactive control here that
 *      pretends to do something.
 *   2. "Do not hard-code dashboard statistics" - no numbers are invented; the
 *      page honestly states which phase implements the module.
 *
 * As each phase is completed, the corresponding page replaces this scaffold with
 * real, database-backed functionality.
 */
export function ModuleScaffold({
  title,
  description,
  phase,
  icon,
}: {
  title: string;
  description: string;
  /** The build phase that will implement this module. */
  phase: number;
  /** Icon used by the empty state. Defaults to a construction icon. */
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon ?? Construction}
        title={`${title} is scheduled for Phase ${phase}`}
        description="The route, layout and navigation for this module are already in place. Real, database-backed functionality is added in the phase listed above - this platform never displays fabricated security data."
      />
    </div>
  );
}
