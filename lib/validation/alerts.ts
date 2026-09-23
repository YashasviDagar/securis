import { z } from "zod";
import { ALERT_SORT_FIELDS, type AlertQuery } from "@/types/alerts";
import { ALERT_STATUSES, SEVERITIES, type AlertStatus, type Severity } from "@/types/security";

/**
 * Securis - Alert query validation
 *
 * URL/search parameters are untrusted, so they are validated and coerced before
 * reaching the database. Every field has a `.catch()` fallback so a malformed
 * query degrades to the default view instead of throwing.
 *
 * Connection: app/(soc)/alerts/page.tsx and app/api/alerts/route.ts.
 */

export const DEFAULT_ALERT_PAGE_SIZE = 25;
export const MAX_ALERT_PAGE_SIZE = 100;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(10)
    .max(MAX_ALERT_PAGE_SIZE)
    .catch(DEFAULT_ALERT_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  severity: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  sourceIp: z.string().trim().min(1).max(64).optional().catch(undefined),
  targetUser: z.string().trim().min(1).max(256).optional().catch(undefined),
  ruleCode: z.string().trim().min(1).max(128).optional().catch(undefined),
  assigned: z.enum(["assigned", "unassigned"]).optional().catch(undefined),
  from: z.string().trim().min(1).optional().catch(undefined),
  to: z.string().trim().min(1).optional().catch(undefined),
  sortBy: z.enum(ALERT_SORT_FIELDS).catch("createdAt"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
});

/** Parse a comma-separated list, keeping only known values. */
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

/** Parse an optional date bound; date-only values expand to start/end of day. */
function parseDateBound(
  value: string | undefined,
  bound: "start" | "end",
): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = bound === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Validate and coerce raw search params into an `AlertQuery`. Never throws. */
export function parseAlertQuery(input: RawSearchParams): AlertQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    severity: first(input.severity),
    status: first(input.status),
    sourceIp: first(input.sourceIp),
    targetUser: first(input.targetUser),
    ruleCode: first(input.ruleCode),
    assigned: first(input.assigned),
    from: first(input.from),
    to: first(input.to),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    severity: parseCsv<Severity>(parsed.severity, SEVERITIES),
    status: parseCsv<AlertStatus>(parsed.status, ALERT_STATUSES),
    sourceIp: parsed.sourceIp,
    targetUser: parsed.targetUser,
    ruleCode: parsed.ruleCode,
    assigned: parsed.assigned,
    from: parseDateBound(parsed.from, "start"),
    to: parseDateBound(parsed.to, "end"),
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}
