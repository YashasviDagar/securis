import { prisma } from "@/database/client";
import { ingestEvents } from "@/server/ingestion/pipeline";
import { buildScenarioEvents, SCENARIO_DEFINITIONS } from "./scenarios";
import type { IngestionActor } from "@/types/ingestion";
import type { SimulationResult, SimulationScenario } from "@/types/simulation";

/**
 * Securis - Simulation service
 *
 * Runs a scenario through the **real** ingestion pipeline (validation → parser →
 * normaliser → persistence → detection). Nothing is faked: the events are
 * stored, the detection engine evaluates them, and alerts are raised exactly as
 * they would be for genuine traffic.
 *
 * The simulation is strictly local — see scenarios.ts.
 *
 * Connection: server/simulation/scenarios.ts -> server/ingestion/pipeline.ts.
 */

export interface SimulationContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Run one scenario and summarise the outcome. */
export async function runSimulation(
  scenario: SimulationScenario,
  actor: IngestionActor,
  context: SimulationContext = {},
): Promise<SimulationResult> {
  const events = buildScenarioEvents(scenario);
  const definition = SCENARIO_DEFINITIONS.find((entry) => entry.id === scenario);

  const result = await ingestEvents(events, actor, context);

  // Fetch the alerts this scenario is expected to have produced. Simulation uses
  // a fresh source IP per run, so the newest alerts for the rule are this run's.
  const alerts = definition?.expectedRule
    ? await prisma.alert.findMany({
        where: { rule: { code: definition.expectedRule } },
        orderBy: { lastSeen: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          riskScore: true,
        },
      })
    : [];

  return {
    scenario,
    scenarioName: definition?.name ?? scenario,
    received: result.received,
    accepted: result.accepted,
    rejected: result.rejected,
    rulesEvaluated: result.detection?.rulesEvaluated ?? 0,
    findings: result.detection?.findings ?? 0,
    alertsCreated: result.detection?.alertsCreated ?? 0,
    alertsUpdated: result.detection?.alertsUpdated ?? 0,
    alerts,
    sampleEventTypes: [
      ...new Set(events.map((event) => String(event.eventType ?? "UNKNOWN"))),
    ],
  };
}
