import { z } from "zod";
import { SEVERITIES, SOURCE_TYPES, type Severity } from "@/types/security";
import { EVENT_SORT_FIELDS, type EventQuery } from "@/types/events";

/**
 * Securis - Event query validation
 *
 * URL/search parameters are untrusted input, so they are validated and coerced
 * before they reach the database. Every field has a safe fallback via `.catch()`
 * so a malformed query degrades to the default view instead of throwing.
 *
 * Connection: app/(soc)/events/page.tsx and app/api/events/route.ts.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Raw search-param bag as provided by Next.js. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Take the first value when a param appears multiple times. */
function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  severity: z.string().optional().catch(undefined),
  eventType: z.string().trim().min(1).max(128).optional().catch(undefined),
  source: z.string().trim().min(1).max(128).optional().catch(undefined),
  sourceType: z.enum(SOURCE_TYPES).optional().catch(undefined),
  sourceIp: z.string().trim().min(1).max(64).optional().catch(undefined),
  username: z.string().trim().min(1).max(256).optional().catch(undefined),
  status: z.string().trim().min(1).max(64).optional().catch(undefined),
  from: z.string().trim().min(1).optional().catch(undefined),
  to: z.string().trim().min(1).optional().catch(undefined),
  sortBy: z.enum(EVENT_SORT_FIELDS).catch("timestamp"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
});

/** Parse a comma-separated severity list, keeping only known severities. */
function parseSeverities(value: string | undefined): Severity[] {
  if (!value) return [];
  const allowed = new Set<string>(SEVERITIES);
  return value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is Severity => allowed.has(part));
}

/**
 * Parse an optional date bound.
 *
 * Accepts either a full ISO timestamp or a plain `YYYY-MM-DD` date (as produced
 * by an HTML date input). Date-only bounds are expanded to the start or end of
 * that UTC day so the range is inclusive and unambiguous.
 */
function parseDateBound(
  value: string | undefined,
  bound: "start" | "end",
): Date | undefined {
  if (!value) return undefined;

  // Date-only form: expand to the beginning/end of the day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = bound === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Validate and coerce raw search params into an `EventQuery`.
 * Never throws: invalid input falls back to safe defaults.
 */
export function parseEventQuery(input: RawSearchParams): EventQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    severity: first(input.severity),
    eventType: first(input.eventType),
    source: first(input.source),
    sourceType: first(input.sourceType),
    sourceIp: first(input.sourceIp),
    username: first(input.username),
    status: first(input.status),
    from: first(input.from),
    to: first(input.to),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    severity: parseSeverities(parsed.severity),
    eventType: parsed.eventType,
    source: parsed.source,
    sourceType: parsed.sourceType,
    sourceIp: parsed.sourceIp,
    username: parsed.username,
    status: parsed.status,
    from: parseDateBound(parsed.from, "start"),
    to: parseDateBound(parsed.to, "end"),
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}
