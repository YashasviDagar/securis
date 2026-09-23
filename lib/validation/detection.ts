import { z } from "zod";
import { GROUP_BY_FIELDS } from "@/types/detection";
import { SOURCE_TYPES, type RuleType } from "@/types/security";
import type { RuleCondition } from "@/types/detection";

/**
 * Securis - Detection rule condition validation
 *
 * A rule's `condition` is stored as JSON in the database. Before the engine
 * evaluates it, it is validated against the schema for the rule's type. This
 * means a malformed rule is reported as an error rather than crashing the
 * engine or silently matching nothing.
 *
 * Connection: server/detection/engine.ts, and (Phase 12) rule management.
 */

const stringOrArray = z.union([z.string(), z.array(z.string())]);
const optionalStringOrArray = stringOrArray.optional();
const sourceTypeSchema = z.enum(SOURCE_TYPES);
const optionalSourceType = z.union([sourceTypeSchema, z.array(sourceTypeSchema)]).optional();

/** Fields every condition may use to filter candidate events. */
const baseFilters = {
  eventType: optionalStringOrArray,
  sourceType: optionalSourceType,
  status: optionalStringOrArray,
  resource: optionalStringOrArray,
  username: z.string().optional(),
};

/** EVENT_MATCH */
export const eventMatchConditionSchema = z.object({
  ...baseFilters,
  resourceMatch: z.enum(["exact", "contains"]).optional(),
  messageContains: z.string().optional(),
});

/** THRESHOLD / TIME_WINDOW / IP_BASED */
export const aggregateConditionSchema = z.object({
  ...baseFilters,
  groupBy: z.enum(GROUP_BY_FIELDS),
  count: z.number().int().positive(),
  windowSeconds: z.number().int().positive().optional(),
});

/** CORRELATION */
export const correlationConditionSchema = z.object({
  failedEventType: z.string().min(1),
  successEventType: z.string().min(1),
  groupBy: z.enum(["username", "sourceIp"]),
  count: z.number().int().positive().optional(),
  windowSeconds: z.number().int().positive().optional(),
  requireNewIp: z.boolean().optional(),
});

/** USER_BASED */
export const userBasedConditionSchema = z.object({
  ...baseFilters,
  newIp: z.boolean().optional(),
  newDevice: z.boolean().optional(),
  offHours: z.boolean().optional(),
  failedBeforeSuccess: z.boolean().optional(),
  minSignals: z.number().int().positive().optional(),
  count: z.number().int().positive().optional(),
  windowSeconds: z.number().int().positive().optional(),
  offHoursStart: z.number().int().min(0).max(23).optional(),
  offHoursEnd: z.number().int().min(0).max(23).optional(),
});

/** Select the schema that applies to a rule type. */
export function conditionSchemaFor(ruleType: RuleType) {
  switch (ruleType) {
    case "EVENT_MATCH":
      return eventMatchConditionSchema;
    case "THRESHOLD":
    case "TIME_WINDOW":
    case "IP_BASED":
      return aggregateConditionSchema;
    case "CORRELATION":
      return correlationConditionSchema;
    case "USER_BASED":
      return userBasedConditionSchema;
  }
}

export type ParsedConditionResult =
  | { ok: true; condition: RuleCondition }
  | { ok: false; message: string };

/**
 * Validate a raw condition document for the given rule type.
 * Never throws; returns a result object.
 */
export function parseCondition(
  ruleType: RuleType,
  raw: unknown,
): ParsedConditionResult {
  const result = conditionSchemaFor(ruleType).safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".") || "condition";
    return { ok: false, message: `${path}: ${first?.message ?? "invalid"}` };
  }
  return { ok: true, condition: result.data as RuleCondition };
}
