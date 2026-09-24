import { z } from "zod";
import { RULE_SORT_FIELDS, type RuleQuery } from "@/types/rules";
import {
  RULE_TYPES,
  SEVERITIES,
  type RuleType,
  type Severity,
} from "@/types/security";
import { parseCondition } from "@/lib/validation/detection";

/**
 * Securis - Detection rule validation
 *
 * The `condition` document is type-specific, so it is validated with the same
 * schema the detection engine uses (`parseCondition`). A rule can therefore
 * never be stored in a shape the engine cannot evaluate.
 *
 * Connection: app/api/detection-rules/**, app/(soc)/detection-rules/**.
 */

export const DEFAULT_RULE_PAGE_SIZE = 25;
export const MAX_RULE_PAGE_SIZE = 100;

/** Upper bound for a rule time window (30 days). */
const MAX_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(MAX_RULE_PAGE_SIZE).catch(DEFAULT_RULE_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  severity: z.string().optional().catch(undefined),
  ruleType: z.string().optional().catch(undefined),
  enabled: z.enum(["true", "false"]).optional().catch(undefined),
  sortBy: z.enum(RULE_SORT_FIELDS).catch("code"),
  sortDir: z.enum(["asc", "desc"]).catch("asc"),
});

function parseCsv<T extends string>(
  value: string | undefined,
  allowed: readonly string[],
): T[] {
  if (!value) return [];
  const set = new Set(allowed);
  return value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is T => set.has(part));
}

/** Validate and coerce raw search params into a `RuleQuery`. Never throws. */
export function parseRuleQuery(input: RawSearchParams): RuleQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    severity: first(input.severity),
    ruleType: first(input.ruleType),
    enabled: first(input.enabled),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    severity: parseCsv<Severity>(parsed.severity, SEVERITIES),
    ruleType: parseCsv<RuleType>(parsed.ruleType, RULE_TYPES),
    enabled: parsed.enabled === undefined ? undefined : parsed.enabled === "true",
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

const ruleFields = {
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{3,64}$/, "Use UPPER_SNAKE_CASE (letters, digits and underscores)."),
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(200),
  description: z.string().trim().min(1, "Description is required.").max(2000),
  ruleType: z.enum(RULE_TYPES),
  severity: z.enum(SEVERITIES),
  /** Type-specific document; validated in the refinements below. */
  condition: z.unknown(),
  threshold: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  timeWindowSeconds: z.coerce.number().int().positive().max(MAX_WINDOW_SECONDS).nullable().optional(),
  enabled: z.boolean().default(true),
};

/** Create a detection rule. */
export const createRuleSchema = z
  .object(ruleFields)
  .superRefine((value, ctx) => {
    const result = parseCondition(value.ruleType, value.condition);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", path: ["condition"], message: result.message });
    }
  });

export type CreateRuleInput = z.infer<typeof createRuleSchema>;

/**
 * Update a rule. All fields optional, but at least one must be present. When
 * `condition` changes, `ruleType` must be supplied so the condition can be
 * validated against the right schema.
 */
export const updateRuleSchema = z
  .object({
    code: ruleFields.code.optional(),
    name: ruleFields.name.optional(),
    description: ruleFields.description.optional(),
    ruleType: ruleFields.ruleType.optional(),
    severity: ruleFields.severity.optional(),
    condition: z.unknown().optional(),
    threshold: ruleFields.threshold,
    timeWindowSeconds: ruleFields.timeWindowSeconds,
    enabled: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.ruleType !== undefined ||
      value.severity !== undefined ||
      value.condition !== undefined ||
      value.threshold !== undefined ||
      value.timeWindowSeconds !== undefined ||
      value.enabled !== undefined,
    { message: "No changes supplied." },
  )
  .superRefine((value, ctx) => {
    if (value.condition !== undefined) {
      if (value.ruleType === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["ruleType"],
          message: "Rule type is required when changing the condition.",
        });
        return;
      }
      const result = parseCondition(value.ruleType, value.condition);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", path: ["condition"], message: result.message });
      }
    }
  });

export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
