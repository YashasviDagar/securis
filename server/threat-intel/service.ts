import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import { recordAudit } from "@/server/services/audit-service";
import { INDICATOR_TYPES, type IndicatorType } from "@/types/security";
import type {
  IndicatorFacets,
  IndicatorListItem,
  IndicatorQuery,
} from "@/types/threat-intel";
import type { Paginated } from "@/types/common";
import type {
  CreateIndicatorInput,
  UpdateIndicatorInput,
} from "@/lib/validation/threat-intel";

/**
 * Securis - Threat intelligence service
 *
 * Owns the local indicator database. This is the layer that would sit in front
 * of an external feed: swapping the local table for a feed client would not
 * change the API, the UI, or the detection engine (which consumes
 * `matcher.ts`).
 *
 * No API keys or feed URLs exist anywhere in this module.
 *
 * Connection: database/client.ts (ThreatIndicator) + audit-service.
 */

export interface MutationActor {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SELECT = {
  id: true,
  type: true,
  value: true,
  threatType: true,
  confidence: true,
  source: true,
  description: true,
  firstSeen: true,
  lastSeen: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ThreatIndicatorSelect;

/** Normalise a value for storage (lower-case domains/hashes for stable matching). */
function normaliseValue(type: IndicatorType, value: string): string {
  const trimmed = value.trim();
  if (type === "DOMAIN" || type === "HASH") return trimmed.toLowerCase();
  return trimmed;
}

/** Build the Prisma `where` clause for an indicator query. */
function buildWhere(query: IndicatorQuery): Prisma.ThreatIndicatorWhereInput {
  const where: Prisma.ThreatIndicatorWhereInput = {};
  const and: Prisma.ThreatIndicatorWhereInput[] = [];

  if (query.type.length > 0) where.type = { in: query.type };
  if (query.threatType) where.threatType = query.threatType;
  if (query.source) where.source = query.source;
  if (query.confidenceMin !== undefined) where.confidence = { gte: query.confidenceMin };
  if (query.active !== undefined) where.active = query.active;

  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { value: { contains: term, mode: "insensitive" } },
        { threatType: { contains: term, mode: "insensitive" } },
        { source: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List indicators with server-side pagination, filtering and sorting. */
export async function listIndicators(
  query: IndicatorQuery,
): Promise<Paginated<IndicatorListItem>> {
  const where = buildWhere(query);

  const total = await prisma.threatIndicator.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.threatIndicator.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: SELECT,
  });

  return { items: rows, page, pageSize: query.pageSize, total, totalPages };
}

/** Fetch a single indicator. */
export async function getIndicatorById(id: string): Promise<IndicatorListItem | null> {
  return prisma.threatIndicator.findUnique({ where: { id }, select: SELECT });
}

/** Distinct filter values drawn from real data. */
export async function getIndicatorFacets(): Promise<IndicatorFacets> {
  const [threatTypes, sources] = await Promise.all([
    prisma.threatIndicator.findMany({
      distinct: ["threatType"],
      select: { threatType: true },
      where: { threatType: { not: null } },
      orderBy: { threatType: "asc" },
      take: 200,
    }),
    prisma.threatIndicator.findMany({
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
      take: 200,
    }),
  ]);

  return {
    types: [...INDICATOR_TYPES],
    threatTypes: threatTypes
      .map((row) => row.threatType)
      .filter((value): value is string => value !== null),
    sources: sources.map((row) => row.source),
  };
}

export type WriteResult =
  | { ok: true; indicator: IndicatorListItem }
  | { ok: false; reason: "DUPLICATE" };

/** Create a new indicator. Rejects duplicates (same type + value). */
export async function createIndicator(
  input: CreateIndicatorInput,
  actor: MutationActor,
): Promise<WriteResult> {
  const value = normaliseValue(input.type, input.value);

  const existing = await prisma.threatIndicator.findUnique({
    where: { type_value: { type: input.type, value } },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "DUPLICATE" };

  const now = new Date();
  const indicator = await prisma.threatIndicator.create({
    data: {
      type: input.type,
      value,
      threatType: input.threatType ?? null,
      confidence: input.confidence,
      source: input.source,
      description: input.description ?? null,
      firstSeen: now,
      lastSeen: now,
      active: input.active,
    },
    select: SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "THREAT_INDICATOR_ADDED",
    targetType: "ThreatIndicator",
    targetId: indicator.id,
    targetLabel: value,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { type: input.type, confidence: input.confidence, source: input.source },
  });

  return { ok: true, indicator };
}

/** Update an indicator (including retiring it via `active`). */
export async function updateIndicator(
  id: string,
  input: UpdateIndicatorInput,
  actor: MutationActor,
): Promise<WriteResult | null> {
  const current = await prisma.threatIndicator.findUnique({
    where: { id },
    select: { id: true, type: true, value: true },
  });
  if (!current) return null;

  const resolvedType = input.type ?? current.type;
  const data: Prisma.ThreatIndicatorUpdateInput = {};

  if (input.value !== undefined) {
    const value = normaliseValue(resolvedType, input.value);
    const duplicate = await prisma.threatIndicator.findFirst({
      where: { type: resolvedType, value, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) return { ok: false, reason: "DUPLICATE" };
    data.value = value;
    data.type = resolvedType;
  }
  if (input.threatType !== undefined) data.threatType = input.threatType;
  if (input.confidence !== undefined) data.confidence = input.confidence;
  if (input.source !== undefined) data.source = input.source;
  if (input.description !== undefined) data.description = input.description;
  if (input.active !== undefined) {
    data.active = input.active;
    // Re-observed indicators get a fresh "last seen" timestamp.
    if (input.active) data.lastSeen = new Date();
  }

  const indicator = await prisma.threatIndicator.update({
    where: { id },
    data,
    select: SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "THREAT_INDICATOR_UPDATED",
    targetType: "ThreatIndicator",
    targetId: id,
    targetLabel: indicator.value,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: {
      type: indicator.type,
      active: indicator.active,
      confidence: indicator.confidence,
    },
  });

  return { ok: true, indicator };
}

/** Delete an indicator. */
export async function deleteIndicator(
  id: string,
  actor: MutationActor,
): Promise<boolean> {
  const current = await prisma.threatIndicator.findUnique({
    where: { id },
    select: { id: true, value: true, type: true },
  });
  if (!current) return false;

  await prisma.threatIndicator.delete({ where: { id } });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "THREAT_INDICATOR_DELETED",
    targetType: "ThreatIndicator",
    targetId: id,
    targetLabel: current.value,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { type: current.type },
  });

  return true;
}
