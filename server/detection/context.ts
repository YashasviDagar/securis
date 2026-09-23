import type { DetectionFinding, DetectionRuleRecord, RuleCondition } from "@/types/detection";

/**
 * Securis - Detection evaluation context
 *
 * Every rule evaluator receives the same context object. `from`/`to` define the
 * inclusive time window the rule may inspect, and `windowSeconds`/`threshold`
 * are already resolved from the rule and its condition.
 *
 * Connection: server/detection/engine.ts -> server/detection/rules/**.
 */
export interface EvaluationContext<C extends RuleCondition = RuleCondition> {
  rule: DetectionRuleRecord;
  condition: C;
  /** Inclusive start of the evaluation window. */
  from: Date;
  /** Inclusive end of the evaluation window. */
  to: Date;
  /** Effective window length in seconds (rule.timeWindowSeconds or default). */
  windowSeconds: number;
  /** Effective threshold (rule.threshold or the condition's count). */
  threshold: number;
}

/** A function that evaluates one rule type and returns candidate findings. */
export type RuleEvaluator<C extends RuleCondition = RuleCondition> = (
  context: EvaluationContext<C>,
) => Promise<DetectionFinding[]>;
