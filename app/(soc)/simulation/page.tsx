import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SimulationPanel } from "@/components/simulation/simulation-panel";
import { requirePermission } from "@/auth/current-user";
import { SCENARIO_DEFINITIONS } from "@/server/simulation/scenarios";

export const metadata: Metadata = { title: "Attack Simulation · Securis" };

/**
 * /simulation - Attack simulation laboratory.
 *
 * Server component. Each scenario generates controlled local events that flow
 * through the real ingestion and detection pipeline. The lab only touches
 * Securis' own test data; it never targets an external system.
 *
 * Authorization: `requirePermission("simulation:run")` (ADMIN / SECURITY_ANALYST).
 *
 * Connection: server/simulation/** -> app/api/simulation.
 */
export default async function SimulationPage() {
  await requirePermission("simulation:run");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attack Simulation"
        description="Generate controlled attack traffic against Securis' own test data and watch the detection engine respond."
      />

      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Every scenario writes real events through the normal pipeline —
            validation, parsing, normalisation, storage and detection. Nothing is
            mocked, and nothing leaves this application.
          </p>
          <p className="text-[0.72rem]">
            Simulated events are tagged <span className="font-mono">metadata.simulation = true</span>{" "}
            and use RFC 5737 documentation addresses, so they are always
            distinguishable from real telemetry.
          </p>
        </div>
      </div>

      <SimulationPanel scenarios={SCENARIO_DEFINITIONS} />
    </div>
  );
}
