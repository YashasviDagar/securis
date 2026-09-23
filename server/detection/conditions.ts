import type { Prisma } from "@prisma/client";
import type { DetectionRuleRecord } from "@/types/detection";
import type { SourceType } from "@/types/security";

/**
 * Securis - Detection condition helpers
 *
 * Shared plumbing for the evaluators: translating rule filters into Prisma
 * `where` clauses and resolving window/threshold values with their defaults.
 *
 * Connection: server/detection/rules/**.
 */

/** The subset of a condition that filters candidate events. */
export interface MatchFilters {
  eventType?: string | string[];
  sourceType?: SourceType | SourceType[];
  status?: string | string[];
  resource?: string | string[];
  username?: string;
  resourceMatch?: "exact" | "contains";
  messageContains?: string;
}

/** Convert a value that may be a scalar or an array into an array. */
function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Build a Prisma `where` clause for the given filters and inclusive time window.
 * All values come from a validated condition, so they are safe to use directly.
 */
export function buildEventWhere(
  filters: MatchFilters,
  from: Date,
  to: Date,
): Prisma.SecurityEventWhereInput {
  const where: Prisma.SecurityEventWhereInput = {
    timestamp: { gte: from, lte: to },
  };

  if (filters.eventType) {
    const values = toArray(filters.eventType);
    where.eventType = values.length === 1 ? values[0] : { in: values };
  }

  if (filters.sourceType) {
    const values = toArray(filters.sourceType);
    where.sourceType = values.length === 1 ? values[0] : { in: values };
  }

  if (filters.status) {
    const values = toArray(filters.status);
    where.status = values.length === 1 ? values[0] : { in: values };
  }

  if (filters.resource) {
    const values = toArray(filters.resource);
    if (filters.resourceMatch === "contains") {
      // Substring match against any of the listed resources.
      where.OR = values.map((value) => ({
        resource: { contains: value, mode: "insensitive" as const },
      }));
    } else {
      where.resource = values.length === 1 ? values[0] : { in: values };
    }
  }

  if (filters.username) {
    where.username = filters.username;
  }

  if (filters.messageContains) {
    where.message = { contains: filters.messageContains, mode: "insensitive" };
  }

  return where;
}

/** Default window when neither the rule nor the condition specifies one. */
export const DEFAULT_WINDOW_SECONDS = 300;

/** Resolve the effective window length for a rule. */
export function resolveWindowSeconds(
  rule: Pick<DetectionRuleRecord, "timeWindowSeconds">,
  conditionWindow?: number,
): number {
  return conditionWindow ?? rule.timeWindowSeconds ?? DEFAULT_WINDOW_SECONDS;
}

/** Resolve the effective threshold for a rule. */
export function resolveThreshold(
  rule: Pick<DetectionRuleRecord, "threshold">,
  conditionCount?: number,
  fallback = 1,
): number {
  return conditionCount ?? rule.threshold ?? fallback;
}

/**
 * Compute a stable window bucket start (ms) for a timestamp. Used to build the
 * alert dedupe key so repeated scans of the same events map to the same alert.
 */
export function windowBucketStart(timestamp: Date, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(timestamp.getTime() / windowMs) * windowMs;
}
