import { z } from "zod";
import { INCIDENT_SORT_FIELDS, type IncidentQuery } from "@/types/incidents";
import {
  INCIDENT_STATUSES,
  SEVERITIES,
  type IncidentStatus,
  type Severity,
} from "@/types/security";

/**
 * Securis - Incident query and mutation validation
 *
 * Connection: app/(soc)/incidents/page.tsx, app/api/incidents/**.
 */

export const DEFAULT_INCIDENT_PAGE_SIZE = 25;
export const MAX_INCIDENT_PAGE_SIZE = 100;

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
    .max(MAX_INCIDENT_PAGE_SIZE)
    .catch(DEFAULT_INCIDENT_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  severity: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  assignedToId: z.string().trim().min(1).max(64).optional().catch(undefined),
  assigned: z.enum(["assigned", "unassigned"]).optional().catch(undefined),
  from: z.string().trim().min(1).optional().catch(undefined),
  to: z.string().trim().min(1).optional().catch(undefined),
  sortBy: z.enum(INCIDENT_SORT_FIELDS).catch("createdAt"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
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

/** Validate and coerce raw search params into an `IncidentQuery`. Never throws. */
export function parseIncidentQuery(input: RawSearchParams): IncidentQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    severity: first(input.severity),
    status: first(input.status),
    assignedToId: first(input.assignedToId),
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
    status: parseCsv<IncidentStatus>(parsed.status, INCIDENT_STATUSES),
    assignedToId: parsed.assignedToId,
    assigned: parsed.assigned,
    from: parseDateBound(parsed.from, "start"),
    to: parseDateBound(parsed.to, "end"),
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/** Create an incident from one or more alerts. */
export const createIncidentSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  description: z.string().trim().min(1, "Description is required.").max(4000),
  severity: z.enum(SEVERITIES).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  alertIds: z.array(z.string().min(1)).min(1, "Select at least one alert.").max(50),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

/** Update an incident: status, assignment, resolution text and content. */
export const updateIncidentSchema = z
  .object({
    status: z.enum(INCIDENT_STATUSES).optional(),
    assignedToId: z.string().min(1).nullable().optional(),
    resolution: z.string().trim().max(4000).nullable().optional(),
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.assignedToId !== undefined ||
      value.resolution !== undefined ||
      value.title !== undefined ||
      value.description !== undefined,
    { message: "No changes supplied." },
  );

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

/** Add a note to an incident. */
export const incidentNoteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty.").max(4000),
});
