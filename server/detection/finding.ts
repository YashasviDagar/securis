import { windowBucketStart } from "./conditions";
import type { DetectionFinding, DetectionRuleRecord } from "@/types/detection";

/**
 * Securis - Detection finding builder
 *
 * Centralises construction of a `DetectionFinding` so every evaluator produces
 * a consistent object. It captures the raw evidence needed for scoring
 * (severity, rule type, event count, threshold, source IP, target account) and
 * a stable dedupe key.
 *
 * Risk scoring is intentionally NOT done here: the engine enriches each finding
 * with threat-intelligence and repeated-behaviour context before scoring, so
 * `riskScore`/`riskFactors` are placeholders until `scoreFinding` runs.
 *
 * The dedupe key is `<ruleCode>:<groupValue>:<windowBucketStartMs>`, which makes
 * repeated scans over the same events idempotent (they update one alert) while
 * still allowing a new alert when the same behaviour recurs in a later window.
 *
 * Connection: server/detection/rules/** -> server/detection/engine.ts.
 */

export interface BuildFindingInput {
  rule: DetectionRuleRecord;
  /** The group this finding is about (IP, username, ...). Null for global. */
  groupValue: string | null;
  firstSeen: Date;
  lastSeen: Date;
  eventIds: string[];
  sourceIp?: string | null;
  targetUser?: string | null;
  windowSeconds: number;
  eventCount?: number;
  threshold?: number;
  details: Record<string, unknown>;
  /** Override the alert title (defaults to the rule name). */
  title?: string;
  /** Override the alert description (defaults to the rule description). */
  description?: string;
}

export function buildFinding(input: BuildFindingInput): DetectionFinding {
  const bucket = windowBucketStart(input.firstSeen, input.windowSeconds);

  return {
    ruleId: input.rule.id,
    ruleCode: input.rule.code,
    ruleName: input.rule.name,
    ruleType: input.rule.ruleType,
    severity: input.rule.severity,
    title: input.title ?? input.rule.name,
    description: input.description ?? input.rule.description,
    dedupeKey: `${input.rule.code}:${input.groupValue ?? "global"}:${bucket}`,
    groupValue: input.groupValue,
    // Placeholder until server/detection/engine.ts scores the finding.
    riskScore: 0,
    riskFactors: [],
    threatIntel: null,
    eventCount: input.eventCount,
    threshold: input.threshold,
    sourceIp: input.sourceIp ?? null,
    targetUser: input.targetUser ?? null,
    firstSeen: input.firstSeen,
    lastSeen: input.lastSeen,
    eventIds: input.eventIds,
    details: input.details,
  };
}
