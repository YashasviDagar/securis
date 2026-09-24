import type { Severity } from "./security";

/**
 * Securis - Attack simulation types
 *
 * The simulation lab generates *controlled local* security events that flow
 * through the real ingestion and detection pipeline. It never targets anything
 * outside the application's own database.
 *
 * Connection: server/simulation/**, app/api/simulation, app/(soc)/simulation.
 */

export const SIMULATION_SCENARIOS = [
  "BRUTE_FORCE",
  "ACCOUNT_TAKEOVER",
  "PRIVILEGE_ESCALATION",
  "API_ABUSE",
  "UNAUTHORIZED_ACCESS",
  "NORMAL_TRAFFIC",
] as const;

export type SimulationScenario = (typeof SIMULATION_SCENARIOS)[number];

/** Metadata describing a scenario, used to render the lab. */
export interface ScenarioDefinition {
  id: SimulationScenario;
  name: string;
  description: string;
  /** The rule this scenario is expected to trigger (null for normal traffic). */
  expectedRule: string | null;
  /** Approximate number of events generated per run. */
  eventCount: number;
  severity: Severity;
}

/** Result of running a scenario. */
export interface SimulationResult {
  scenario: SimulationScenario;
  scenarioName: string;
  received: number;
  accepted: number;
  rejected: number;
  rulesEvaluated: number;
  findings: number;
  alertsCreated: number;
  alertsUpdated: number;
  /** Alerts touched by the run, for immediate feedback in the UI. */
  alerts: { id: string; title: string; severity: Severity; status: string; riskScore: number }[];
  /** A few representative event types that were generated. */
  sampleEventTypes: string[];
}
