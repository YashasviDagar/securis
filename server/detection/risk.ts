import { SEVERITY_WEIGHTS, type Severity } from "@/types/security";

/**
 * Securis - Risk scoring (baseline)
 *
 * A DETERMINISTIC, documented scoring model. Given identical inputs it always
 * produces the same score - no randomness - so detections are reproducible and
 * testable.
 *
 * This baseline is deliberately simple and is expanded in Phase 8 with
 * frequency, threat-intelligence matches, repeated behaviour and source/target
 * reputation. The factor breakdown returned here is what the UI renders to
 * explain a score.
 *
 * Connection: server/detection/finding.ts (buildFinding), Phase 8 extends it.
 */

export interface RiskInput {
  severity: Severity;
  /** Number of matching events contributing to the detection. */
  eventCount?: number;
  /** Threshold the rule required; used to gauge how far above it we are. */
  threshold?: number;
  sourceIp?: string | null;
  targetUser?: string | null;
}

export interface RiskFactor {
  factor: string;
  weight: number;
}

export interface RiskResult {
  score: number;
  factors: RiskFactor[];
}

/** Accounts whose compromise is treated as more severe. */
const PRIVILEGED_ACCOUNTS = new Set([
  "admin",
  "administrator",
  "root",
  "superuser",
  "system",
  "sa",
]);

/**
 * Compute a 0-100 risk score with an itemised breakdown.
 *
 * Model:
 *   base   = SEVERITY_WEIGHTS[severity] * 6      (INFO 6 … CRITICAL 60)
 *   volume = min(20, round(count / threshold * 10))   (0 when unknown)
 *   target = +10 when a privileged account is targeted
 *   source = +5 when a source IP is recorded
 * The total is clamped to 0-100.
 */
export function computeRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];

  const base = SEVERITY_WEIGHTS[input.severity] * 6;
  factors.push({ factor: `Base severity ${input.severity}`, weight: base });
  let score = base;

  if (input.eventCount !== undefined && input.threshold && input.threshold > 0) {
    const volume = Math.min(20, Math.round((input.eventCount / input.threshold) * 10));
    if (volume > 0) {
      score += volume;
      factors.push({
        factor: `Volume ${input.eventCount} events vs threshold ${input.threshold}`,
        weight: volume,
      });
    }
  }

  if (input.targetUser && PRIVILEGED_ACCOUNTS.has(input.targetUser.toLowerCase())) {
    score += 10;
    factors.push({ factor: `Privileged account targeted (${input.targetUser})`, weight: 10 });
  }

  if (input.sourceIp) {
    score += 5;
    factors.push({ factor: "Source IP recorded", weight: 5 });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}
