import { windowBucketStart } from "./conditions";
import { computeRisk } from "./risk";
import type { DetectionFinding, DetectionRuleRecord } from "@/types/detection";

/**
 * Securis - Detection finding builder
 *
 * Centralises construction of a `DetectionFinding` so every evaluator produces
 * a consistent object: same risk model, same dedupe-key format, same shape.
 *
 * The dedupe key is `<ruleCode>:<groupValue>:<windowBucketStartMs>`, which makes
 * repeated scans over the same events idempotent (they update one alert) while
 * still allowing a new alert when the same behaviour recurs in a later window.
 *
 * Connection: server/detection/rules/**.
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
  const { score, factors } = computeRisk({
    severity: input.rule.severity,
    eventCount: input.eventCount,
    threshold: input.threshold,
    sourceIp: input.sourceIp,
    targetUser: input.targetUser,
  });

  const bucket = windowBucketStart(input.firstSeen, input.windowSeconds);

  return {
    ruleId: input.rule.id,
    ruleCode: input.rule.code,
    ruleName: input.rule.name,
    severity: input.rule.severity,
    title: input.title ?? input.rule.name,
    description: input.description ?? input.rule.description,
    dedupeKey: `${input.rule.code}:${input.groupValue ?? "global"}:${bucket}`,
    riskScore: score,
    riskFactors: factors,
    sourceIp: input.sourceIp ?? null,
    targetUser: input.targetUser ?? null,
    firstSeen: input.firstSeen,
    lastSeen: input.lastSeen,
    eventIds: input.eventIds,
    details: input.details,
  };
}
