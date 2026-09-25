import { z } from "zod";
import { AUDIT_SORT_FIELDS, type AuditQuery } from "@/types/audit";

/**
 * Securis - Audit query validation
 *
 * Connection: app/(soc)/audit-logs/page.tsx and app/api/audit-logs.
 */

export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_PAGE_SIZE = 200;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(MAX_AUDIT_PAGE_SIZE).catch(DEFAULT_AUDIT_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  action: z.string().trim().min(1).max(64).optional().catch(undefined),
  actorEmail: z.string().trim().min(1).max(254).optional().catch(undefined),
  targetType: z.string().trim().min(1).max(64).optional().catch(undefined),
  ipAddress: z.string().trim().min(1).max(64).optional().catch(undefined),
  from: z.string().trim().min(1).optional().catch(undefined),
  to: z.string().trim().min(1).optional().catch(undefined),
  sortBy: z.enum(AUDIT_SORT_FIELDS).catch("createdAt"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
});

function parseDateBound(value: string | undefined, bound: "start" | "end"): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = bound === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Validate and coerce raw search params into an `AuditQuery`. Never throws. */
export function parseAuditQuery(input: RawSearchParams): AuditQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    action: first(input.action),
    actorEmail: first(input.actorEmail),
    targetType: first(input.targetType),
    ipAddress: first(input.ipAddress),
    from: first(input.from),
    to: first(input.to),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    action: parsed.action,
    actorEmail: parsed.actorEmail,
    targetType: parsed.targetType,
    ipAddress: parsed.ipAddress,
    from: parseDateBound(parsed.from, "start"),
    to: parseDateBound(parsed.to, "end"),
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}
