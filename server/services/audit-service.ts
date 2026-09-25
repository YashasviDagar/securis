import { AuditAction } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import type { AuditFacets, AuditListItem, AuditQuery } from "@/types/audit";
import type { Paginated } from "@/types/common";

/**
 * Securis - Audit service
 *
 * The single writer for the immutable audit trail (Phase 15 builds the reader).
 * Every privileged action in the platform funnels through `recordAudit` so the
 * trail is consistent and impossible to forget in one place but not another.
 *
 * Design rules:
 *   - Audit writes are best-effort: a failure to record must never break the
 *     user-facing operation, but it IS logged server-side for operators.
 *   - Audit rows are append-only. This module intentionally exposes no update
 *     or delete function.
 *   - Never place secrets, passwords or raw tokens in `metadata`.
 *
 * Connection: database/client.ts (Prisma) -> AuditLog table.
 */

export interface AuditInput {
  /** Authenticated actor, when known. */
  actorId?: string | null;
  /** Denormalised actor identity (captured even for unknown/failed logins). */
  actorEmail?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Append an entry to the audit trail.
 *
 * Resolves regardless of success: audit logging must not turn a successful
 * login or an alert update into a 500 response.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    // Never surface audit failures to the caller, but make them visible in logs.
    console.error("[Securis] failed to write audit log:", error);
  }
}

// -----------------------------------------------------------------------------
// Audit explorer queries (Phase 15)
// -----------------------------------------------------------------------------

const SELECT = {
  id: true,
  action: true,
  actorEmail: true,
  targetType: true,
  targetId: true,
  targetLabel: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  createdAt: true,
  actor: { select: { name: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof SELECT }>;

function toListItem(row: AuditRow): AuditListItem {
  return {
    id: row.id,
    action: row.action,
    actorEmail: row.actorEmail,
    actorName: row.actor?.name ?? null,
    targetType: row.targetType,
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

/** Build the Prisma `where` clause for an audit query. */
function buildWhere(query: AuditQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const and: Prisma.AuditLogWhereInput[] = [];

  if (query.action) where.action = query.action as AuditAction;
  if (query.actorEmail) where.actorEmail = query.actorEmail;
  if (query.targetType) where.targetType = query.targetType;
  if (query.ipAddress) where.ipAddress = query.ipAddress;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  if (query.search) {
    const term = query.search;
    // NOTE: `action` is a Postgres enum; comparing it with an arbitrary search
    // string would raise "invalid input value for enum". Actions have their own
    // dedicated filter, so free-text search covers the text columns only.
    and.push({
      OR: [
        { actorEmail: { contains: term, mode: "insensitive" } },
        { targetLabel: { contains: term, mode: "insensitive" } },
        { targetType: { contains: term, mode: "insensitive" } },
        { ipAddress: { contains: term } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List audit entries with server-side pagination, filtering and sorting. */
export async function listAudits(query: AuditQuery): Promise<Paginated<AuditListItem>> {
  const where = buildWhere(query);

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: SELECT,
  });

  return { items: rows.map(toListItem), page, pageSize: query.pageSize, total, totalPages };
}

/** Distinct filter values drawn from real data. */
export async function getAuditFacets(): Promise<AuditFacets> {
  const [targetTypes, actors] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["targetType"],
      select: { targetType: true },
      where: { targetType: { not: null } },
      orderBy: { targetType: "asc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["actorEmail"],
      select: { actorEmail: true },
      where: { actorEmail: { not: null } },
      orderBy: { actorEmail: "asc" },
      take: 200,
    }),
  ]);

  // Actions come from the Prisma enum so the filter always matches the schema.
  return {
    actions: Object.values(AuditAction) as string[],
    targetTypes: targetTypes
      .map((row) => row.targetType)
      .filter((value): value is string => value !== null),
    actors: actors
      .map((row) => row.actorEmail)
      .filter((value): value is string => value !== null),
  };
}
