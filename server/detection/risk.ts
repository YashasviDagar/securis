import {
  SEVERITY_WEIGHTS,
  riskBandFromScore,
  type RiskBand,
  type RuleType,
  type Severity,
} from "@/types/security";
import { isPublicIp } from "@/utils/ip";

/**
 * Securis - Risk scoring engine
 *
 * A DETERMINISTIC, fully documented scoring model. Given identical inputs it
 * always produces the same 0-100 score - there is no randomness - so detections
 * are reproducible, explainable and testable. Every contribution is returned as
 * an itemised factor so the UI can show *why* an alert scored what it did.
 *
 * Factors (see computeRisk for the exact arithmetic):
 *   1. Base severity      - the rule's severity weight
 *   2. Frequency          - how far above the rule threshold the activity is
 *   3. Detection rule     - some rule types are inherently higher confidence
 *   4. Target account     - account-specific targeting, and privileged accounts
 *   5. Source IP          - presence, public routability, threat-intel match
 *   6. Repeated behaviour - this rule+group has fired in earlier windows
 *
 * Bands: 0-25 Low, 26-50 Moderate, 51-75 High, 76-100 Critical.
 *
 * Connection: server/detection/engine.ts (scoring), server/threat-intel/matcher.ts
 * (indicator matches are passed in, keeping this module pure and synchronous).
 */

/** Accounts whose compromise is treated as materially more severe. */
const PRIVILEGED_ACCOUNTS = new Set([
  "admin",
  "administrator",
  "root",
  "superuser",
  "system",
  "sa",
  "service",
]);

/**
 * Extra weight per rule type. Correlation rules observe a multi-stage pattern
 * and behavioural rules aggregate several signals, so both carry more
 * confidence than a single event match.
 */
const RULE_WEIGHTS: Record<RuleType, number> = {
  CORRELATION: 8,
  USER_BASED: 6,
  THRESHOLD: 4,
  IP_BASED: 3,
  TIME_WINDOW: 3,
  EVENT_MATCH: 2,
};

export interface ThreatIntelFactor {
  /** Classification from the indicator, e.g. "Botnet C2". */
  threatType: string | null;
  /** Indicator confidence 0-100. */
  confidence: number;
}

export interface RiskInput {
  severity: Severity;
  ruleType: RuleType;
  /** Number of events contributing to the detection. */
  eventCount?: number;
  /** Threshold the rule required. */
  threshold?: number;
  sourceIp?: string | null;
  targetUser?: string | null;
  /** Matching local threat-intelligence indicator, if any. */
  threatIntel?: ThreatIntelFactor | null;
  /** How many times this rule+group fired in earlier windows. */
  priorOccurrences?: number;
}

export interface RiskFactor {
  factor: string;
  weight: number;
}

export interface RiskResult {
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
}

/** True when the account name is one of the well-known privileged accounts. */
export function isPrivilegedAccount(username: string | null | undefined): boolean {
  if (!username) return false;
  return PRIVILEGED_ACCOUNTS.has(username.trim().toLowerCase());
}

/**
 * Compute the risk score and its factor breakdown.
 *
 * Arithmetic (each step appends a factor):
 *   base      = SEVERITY_WEIGHTS[severity] * 6              (6 … 60)
 *   frequency = min(20, round(eventCount / threshold * 10)) (0 when unknown)
 *   rule      = RULE_WEIGHTS[ruleType]                      (2 … 8)
 *   target    = 3 if an account is targeted, +9 more if privileged
 *   source    = 5 if present, +5 more if publicly routable,
 *               + min(20, round(confidence / 5)) if a threat-intel match
 *   repeat    = min(15, priorOccurrences * 3)
 * The sum is clamped to 0-100.
 */
export function computeRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];

  // 1. Base severity.
  const base = SEVERITY_WEIGHTS[input.severity] * 6;
  factors.push({ factor: `Base severity ${input.severity}`, weight: base });
  let score = base;

  // 2. Frequency relative to the rule threshold.
  // Only meaningful for rules with a real threshold. EVENT_MATCH findings carry
  // threshold = 1, where "count / threshold" would inflate the score for what is
  // simply a single matched event, so those are excluded.
  if (
    input.eventCount !== undefined &&
    input.threshold !== undefined &&
    input.threshold >= 2
  ) {
    const frequency = Math.min(20, Math.round((input.eventCount / input.threshold) * 10));
    if (frequency > 0) {
      score += frequency;
      factors.push({
        factor: `Frequency ${input.eventCount} events vs threshold ${input.threshold}`,
        weight: frequency,
      });
    }
  }

  // 3. Detection rule confidence.
  const ruleWeight = RULE_WEIGHTS[input.ruleType];
  score += ruleWeight;
  factors.push({ factor: `Detection rule type ${input.ruleType}`, weight: ruleWeight });

  // 4. Target account.
  if (input.targetUser) {
    score += 3;
    factors.push({ factor: `Target account identified (${input.targetUser})`, weight: 3 });
    if (isPrivilegedAccount(input.targetUser)) {
      score += 9;
      factors.push({
        factor: `Privileged account involvement (${input.targetUser})`,
        weight: 9,
      });
    }
  }

  // 5. Source IP.
  if (input.sourceIp) {
    score += 5;
    factors.push({ factor: "Source IP recorded", weight: 5 });
    if (isPublicIp(input.sourceIp)) {
      score += 5;
      factors.push({ factor: "Source IP is publicly routable", weight: 5 });
    }
  }
  if (input.threatIntel) {
    const ti = Math.min(20, Math.round(input.threatIntel.confidence / 5));
    if (ti > 0) {
      score += ti;
      factors.push({
        factor: `Threat intelligence match${
          input.threatIntel.threatType ? ` (${input.threatIntel.threatType})` : ""
        } · confidence ${input.threatIntel.confidence}`,
        weight: ti,
      });
    }
  }

  // 6. Repeated behaviour.
  if (input.priorOccurrences && input.priorOccurrences > 0) {
    const repeat = Math.min(15, input.priorOccurrences * 3);
    score += repeat;
    factors.push({
      factor: `Repeated behaviour (${input.priorOccurrences} prior detections)`,
      weight: repeat,
    });
  }

  const clamped = Math.max(0, Math.min(100, score));
  return { score: clamped, band: riskBandFromScore(clamped), factors };
}
