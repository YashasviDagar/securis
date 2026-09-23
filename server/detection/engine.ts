import { prisma } from "@/database/client";
import { parseCondition } from "@/lib/validation/detection";
import { resolveThreshold, resolveWindowSeconds } from "./conditions";
import { evaluateEventMatch } from "./rules/event-match";
import { evaluateAggregate } from "./rules/threshold";
import { evaluateCorrelation } from "./rules/correlation";
import { evaluateUserBased } from "./rules/user-based";
import { upsertAlertFromFinding } from "@/server/services/alert-service";
import { describeError } from "@/utils/errors";
import type {
  DetectionFinding,
  DetectionRuleRecord,
  DetectionRunResult,
  RuleCondition,
} from "@/types/detection";

/**
 * Securis - Detection engine
 *
 * Loads enabled rules from the database and evaluates each one against stored
 * events inside its own time window. Every finding is turned into (or merged
 * with) an alert by the alert service, using the finding's dedupe key so
 * repeated runs are idempotent.
 *
 * The engine is the single entry point for detection. It is invoked:
 *   - by the ingestion pipeline, immediately after events are persisted;
 *   - by `POST /api/detection/scan` for a manual/ad-hoc scan;
 *   - by the attack simulation lab (Phase 14).
 *
 * Connection: database/client.ts -> rules -> evaluators -> alert-service.
 */

export interface RunDetectionOptions {
  /** End of the evaluation window. Defaults to now. */
  to?: Date;
  /**
   * Override each rule's window with a fixed lookback. Useful for a manual
   * "scan the last N hours" operation.
   */
  lookbackSeconds?: number;
  /** Restrict the run to specific rule codes (e.g. for a single-rule test). */
  ruleCodes?: string[];
}

/** Select the evaluator for a rule type and run it with a correctly typed condition. */
async function evaluateRule(
  rule: DetectionRuleRecord,
  condition: RuleCondition,
  from: Date,
  to: Date,
  windowSeconds: number,
  threshold: number,
): Promise<DetectionFinding[]> {
  const context = { rule, from, to, windowSeconds, threshold };

  switch (rule.ruleType) {
    case "EVENT_MATCH":
      return evaluateEventMatch({ ...context, condition: condition as never });
    case "THRESHOLD":
    case "TIME_WINDOW":
    case "IP_BASED":
      return evaluateAggregate({ ...context, condition: condition as never });
    case "CORRELATION":
      return evaluateCorrelation({ ...context, condition: condition as never });
    case "USER_BASED":
      return evaluateUserBased({ ...context, condition: condition as never });
    default:
      return [];
  }
}

/**
 * Run the detection engine.
 */
export async function runDetection(
  options: RunDetectionOptions = {},
): Promise<DetectionRunResult> {
  const to = options.to ?? new Date();

  const rules = await prisma.detectionRule.findMany({
    where: {
      enabled: true,
      ...(options.ruleCodes && options.ruleCodes.length > 0
        ? { code: { in: options.ruleCodes } }
        : {}),
    },
    orderBy: { code: "asc" },
  });

  const result: DetectionRunResult = {
    rulesEvaluated: 0,
    findings: 0,
    alertsCreated: 0,
    alertsUpdated: 0,
    errors: [],
    alerts: [],
  };

  for (const rule of rules) {
    const parsed = parseCondition(rule.ruleType, rule.condition);
    if (!parsed.ok) {
      result.errors.push({ ruleCode: rule.code, message: parsed.message });
      continue;
    }
    const condition = parsed.condition;

    // Resolve window/threshold from the condition first, then the rule columns.
    const conditionWindow =
      "windowSeconds" in condition ? condition.windowSeconds : undefined;
    const conditionCount = "count" in condition ? condition.count : undefined;

    const windowSeconds =
      options.lookbackSeconds ??
      resolveWindowSeconds(rule, conditionWindow);
    const fallback =
      rule.ruleType === "CORRELATION" || rule.ruleType === "USER_BASED" ? 3 : 1;
    const threshold = resolveThreshold(rule, conditionCount, fallback);

    const from = new Date(to.getTime() - windowSeconds * 1000);

    const record: DetectionRuleRecord = {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      ruleType: rule.ruleType,
      severity: rule.severity,
      condition: rule.condition,
      threshold: rule.threshold,
      timeWindowSeconds: rule.timeWindowSeconds,
      enabled: rule.enabled,
    };

    result.rulesEvaluated += 1;

    try {
      const findings = await evaluateRule(
        record,
        condition,
        from,
        to,
        windowSeconds,
        threshold,
      );
      result.findings += findings.length;

      for (const finding of findings) {
        const alert = await upsertAlertFromFinding(finding);
        if (alert.created) result.alertsCreated += 1;
        else result.alertsUpdated += 1;
        result.alerts.push({
          id: alert.id,
          title: alert.title,
          severity: alert.severity,
          status: alert.status,
        });
      }
    } catch (error) {
      // A single failing rule must not abort the whole run.
      result.errors.push({ ruleCode: rule.code, message: describeError(error) });
    }
  }

  return result;
}
