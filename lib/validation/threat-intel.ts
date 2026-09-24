import { z } from "zod";
import {
  INDICATOR_SORT_FIELDS,
  type IndicatorQuery,
} from "@/types/threat-intel";
import { INDICATOR_TYPES, type IndicatorType } from "@/types/security";

/**
 * Securis - Threat intelligence validation
 *
 * Includes the format validators for each indicator kind. They are pure
 * (regex-based, no Node built-ins) so the same rules run in the browser form and
 * on the server.
 *
 * Connection: app/(soc)/threat-intelligence/**, app/api/threat-intelligence/**.
 */

export const DEFAULT_INDICATOR_PAGE_SIZE = 25;
export const MAX_INDICATOR_PAGE_SIZE = 100;

// -----------------------------------------------------------------------------
// Value format validation
// -----------------------------------------------------------------------------

const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Permissive IPv6 check (full expansion is unnecessary for validation). */
const IPV6 = /^[0-9a-fA-F:]{2,45}$/;

const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const HASH = /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i;

function isIp(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && IPV6.test(value));
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate an indicator value for its type.
 * @returns an error message, or null when valid.
 */
export function validateIndicatorValue(type: IndicatorType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Value is required.";

  switch (type) {
    case "IP":
      return isIp(trimmed) ? null : "Enter a valid IPv4 or IPv6 address.";
    case "DOMAIN":
      return DOMAIN.test(trimmed) ? null : "Enter a valid domain (e.g. example.com).";
    case "HASH":
      return HASH.test(trimmed)
        ? null
        : "Enter a valid MD5, SHA-1 or SHA-256 hex digest.";
    case "URL":
      return isUrl(trimmed) ? null : "Enter a valid http(s) URL.";
  }
}

// -----------------------------------------------------------------------------
// Query
// -----------------------------------------------------------------------------

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
    .max(MAX_INDICATOR_PAGE_SIZE)
    .catch(DEFAULT_INDICATOR_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  threatType: z.string().trim().min(1).max(128).optional().catch(undefined),
  source: z.string().trim().min(1).max(128).optional().catch(undefined),
  confidenceMin: z.coerce.number().int().min(0).max(100).optional().catch(undefined),
  active: z.enum(["true", "false"]).optional().catch(undefined),
  sortBy: z.enum(INDICATOR_SORT_FIELDS).catch("createdAt"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
});

/** Validate and coerce raw search params into an `IndicatorQuery`. Never throws. */
export function parseIndicatorQuery(input: RawSearchParams): IndicatorQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    type: first(input.type),
    threatType: first(input.threatType),
    source: first(input.source),
    confidenceMin: first(input.confidenceMin),
    active: first(input.active),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  const allowed = new Set<string>(INDICATOR_TYPES);
  const type = parsed.type
    ? parsed.type
        .split(",")
        .map((part) => part.trim().toUpperCase())
        .filter((part): part is IndicatorType => allowed.has(part))
    : [];

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    type,
    threatType: parsed.threatType,
    source: parsed.source,
    confidenceMin: parsed.confidenceMin,
    active: parsed.active === undefined ? undefined : parsed.active === "true",
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/** Fields shared by create and update. */
const indicatorFields = {
  type: z.enum(INDICATOR_TYPES),
  value: z.string().trim().min(1, "Value is required.").max(512),
  threatType: z.string().trim().max(128).nullish(),
  confidence: z.coerce.number().int().min(0).max(100),
  source: z.string().trim().min(1, "Source is required.").max(128),
  description: z.string().trim().max(1000).nullish(),
  active: z.boolean(),
};

/** Create an indicator. */
export const createIndicatorSchema = z
  .object({
    ...indicatorFields,
    confidence: indicatorFields.confidence.default(50),
    active: indicatorFields.active.default(true),
  })
  .superRefine((value, ctx) => {
    const error = validateIndicatorValue(value.type, value.value);
    if (error) ctx.addIssue({ code: "custom", path: ["value"], message: error });
  });

export type CreateIndicatorInput = z.infer<typeof createIndicatorSchema>;

/**
 * Update an indicator. All fields optional, but at least one must be present.
 * When `value` changes, `type` must be supplied so the new value can be
 * validated against the correct format.
 */
export const updateIndicatorSchema = z
  .object({
    type: indicatorFields.type.optional(),
    value: indicatorFields.value.optional(),
    threatType: indicatorFields.threatType.optional(),
    confidence: indicatorFields.confidence.optional(),
    source: indicatorFields.source.optional(),
    description: indicatorFields.description.optional(),
    active: indicatorFields.active.optional(),
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.value !== undefined ||
      value.threatType !== undefined ||
      value.confidence !== undefined ||
      value.source !== undefined ||
      value.description !== undefined ||
      value.active !== undefined,
    { message: "No changes supplied." },
  )
  .superRefine((value, ctx) => {
    if (value.value !== undefined) {
      if (value.type === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["type"],
          message: "Type is required when changing the value.",
        });
        return;
      }
      const error = validateIndicatorValue(value.type, value.value);
      if (error) ctx.addIssue({ code: "custom", path: ["value"], message: error });
    }
  });

export type UpdateIndicatorInput = z.infer<typeof updateIndicatorSchema>;
