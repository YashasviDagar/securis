import type { AlertStatus, Prisma, Severity } from "@prisma/client";
import { prisma } from "@/database/client";
import { recordAudit } from "@/server/services/audit-service";
import { ALERT_STATUSES, SEVERITIES } from "@/types/security";
import type { DetectionFinding } from "@/types/detection";
import type {
  AlertDetail,
  AlertFacets,
  AlertListItem,
  AlertNoteItem,
  AlertQuery,
} from "@/types/alerts";
import type { Paginated } from "@/types/common";

/**
 * Securis - Alert service
 *
 * Persistence and lifecycle management for alerts.
 *
 *   - `upsertAlertFromFinding` is the detection engine's idempotent writer.
 *   - `listAlerts` / `getAlertById` / `getAlertFacets` power the alert queue.
 *   - `updateAlertStatus` / `assignAlert` / `addAlertNote` implement the analyst
 *     workflow. Every mutation writes an audit entry.
 *
 * Connection: database/client.ts -> Alert (+ AlertNote, Alert<->SecurityEvent).
 */

// -----------------------------------------------------------------------------
// Detection engine writer
// -----------------------------------------------------------------------------

export interface UpsertAlertResult {
  id: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  riskScore: number;
  created: boolean;
}

/** Convert risk factors to a Prisma JSON value. */
function riskFactorsJson(finding: DetectionFinding): Prisma.InputJsonValue {
  return finding.riskFactors as unknown as Prisma.InputJsonValue;
}

/**
 * Create or refresh an alert for a detection finding (idempotent via dedupeKey).
 */
export async function upsertAlertFromFinding(
  finding: DetectionFinding,
): Promise<UpsertAlertResult> {
  const eventLinks =
    finding.eventIds.length > 0
      ? { events: { connect: finding.eventIds.map((id) => ({ id })) } }
      : {};

  const existing = await prisma.alert.findUnique({
    where: { dedupeKey: finding.dedupeKey },
    select: { id: true },
  });

  if (existing) {
    const alert = await prisma.alert.update({
      where: { id: existing.id },
      data: {
        // Refresh recency and risk; leave status/assignment untouched so an
        // analyst's work is never silently reset by a re-scan.
        lastSeen: finding.lastSeen,
        riskScore: finding.riskScore,
        riskFactors: riskFactorsJson(finding),
        ...eventLinks,
      },
      select: { id: true, title: true, severity: true, status: true, riskScore: true },
    });
    return { ...alert, created: false };
  }

  const alert = await prisma.alert.create({
    data: {
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: "NEW",
      riskScore: finding.riskScore,
      riskFactors: riskFactorsJson(finding),
      sourceIp: finding.sourceIp,
      targetUser: finding.targetUser,
      ruleId: finding.ruleId,
      firstSeen: finding.firstSeen,
      lastSeen: finding.lastSeen,
      dedupeKey: finding.dedupeKey,
      ...eventLinks,
    },
    select: { id: true, title: true, severity: true, status: true, riskScore: true },
  });

  await recordAudit({
    action: "ALERT_CREATED",
    targetType: "Alert",
    targetId: alert.id,
    targetLabel: alert.title,
    metadata: {
      ruleCode: finding.ruleCode,
      severity: finding.severity,
      riskScore: finding.riskScore,
      sourceIp: finding.sourceIp,
      targetUser: finding.targetUser,
      eventCount: finding.eventIds.length,
    },
  });

  return { ...alert, created: true };
}

/** Count alerts by status (used by the dashboard in Phase 13). */
export async function countAlertsByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.alert.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

// -----------------------------------------------------------------------------
// Alert queue queries (Phase 9)
// -----------------------------------------------------------------------------

/** Row projection for the queue - deliberately small for performance. */
const LIST_SELECT = {
  id: true,
  title: true,
  severity: true,
  status: true,
  riskScore: true,
  sourceIp: true,
  targetUser: true,
  firstSeen: true,
  lastSeen: true,
  createdAt: true,
  resolvedAt: true,
  rule: { select: { code: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  _count: { select: { events: true, notes: true } },
} satisfies Prisma.AlertSelect;

type AlertRow = Prisma.AlertGetPayload<{ select: typeof LIST_SELECT }>;

/** Map a Prisma row to the UI/API list item. */
function toListItem(alert: AlertRow): AlertListItem {
  return {
    id: alert.id,
    title: alert.title,
    severity: alert.severity,
    status: alert.status,
    riskScore: alert.riskScore,
    sourceIp: alert.sourceIp,
    targetUser: alert.targetUser,
    ruleCode: alert.rule?.code ?? null,
    ruleName: alert.rule?.name ?? null,
    firstSeen: alert.firstSeen,
    lastSeen: alert.lastSeen,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
    assignedTo: alert.assignedTo ?? null,
    eventCount: alert._count.events,
    noteCount: alert._count.notes,
  };
}

/** Build the Prisma `where` clause for an alert query. */
function buildWhere(query: AlertQuery): Prisma.AlertWhereInput {
  const where: Prisma.AlertWhereInput = {};
  const and: Prisma.AlertWhereInput[] = [];

  if (query.severity.length > 0) where.severity = { in: query.severity };
  if (query.status.length > 0) where.status = { in: query.status };
  if (query.sourceIp) where.sourceIp = query.sourceIp;
  if (query.targetUser) where.targetUser = query.targetUser;
  if (query.ruleCode) where.rule = { code: query.ruleCode };
  if (query.assigned === "assigned") where.assignedToId = { not: null };
  if (query.assigned === "unassigned") where.assignedToId = null;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { sourceIp: { contains: term } },
        { targetUser: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List alerts with server-side pagination, filtering and sorting. */
export async function listAlerts(query: AlertQuery): Promise<Paginated<AlertListItem>> {
  const where = buildWhere(query);

  const total = await prisma.alert.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.alert.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: LIST_SELECT,
  });

  return {
    items: rows.map(toListItem),
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

/** Fetch one alert with its notes, related events and incidents. */
export async function getAlertById(id: string): Promise<AlertDetail | null> {
  const alert = await prisma.alert.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      description: true,
      riskFactors: true,
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
      events: {
        orderBy: { timestamp: "asc" },
        select: {
          id: true,
          timestamp: true,
          source: true,
          sourceType: true,
          eventType: true,
          severity: true,
          username: true,
          sourceIp: true,
          status: true,
          message: true,
        },
      },
      incidents: {
        select: { id: true, reference: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!alert) return null;

  const base = toListItem(alert);
  const notes: AlertNoteItem[] = alert.notes.map((note) => ({
    id: note.id,
    body: note.body,
    authorName: note.author.name,
    authorEmail: note.author.email,
    createdAt: note.createdAt,
  }));

  return {
    ...base,
    description: alert.description,
    riskFactors: alert.riskFactors,
    relatedEvents: alert.events,
    relatedIncidents: alert.incidents,
    notes,
  };
}

/** Distinct filter values drawn from real data. */
export async function getAlertFacets(): Promise<AlertFacets> {
  const grouped = await prisma.alert.groupBy({
    by: ["ruleId"],
    _count: { _all: true },
  });
  const ruleIds = grouped
    .map((row) => row.ruleId)
    .filter((id): id is string => id !== null);

  const rules = ruleIds.length
    ? await prisma.detectionRule.findMany({
        where: { id: { in: ruleIds } },
        select: { code: true, name: true },
        orderBy: { code: "asc" },
      })
    : [];

  return {
    rules,
    statuses: [...ALERT_STATUSES],
    severities: [...SEVERITIES],
  };
}

// -----------------------------------------------------------------------------
// Analyst workflow
// -----------------------------------------------------------------------------

/** Statuses that count as "closed" and stamp `resolvedAt`. */
const RESOLVING_STATUSES = new Set<AlertStatus>(["RESOLVED", "FALSE_POSITIVE"]);

/** Active users who can be assigned an alert (used by the actions panel). */
export { getAssignableUsers } from "@/server/services/user-service";

export interface MutationActor {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Change an alert's status, stamping/clearing `resolvedAt` accordingly. */
export async function updateAlertStatus(
  id: string,
  status: AlertStatus,
  actor: MutationActor,
): Promise<AlertListItem | null> {
  const current = await prisma.alert.findUnique({
    where: { id },
    select: { id: true, status: true, title: true },
  });
  if (!current) return null;

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status,
      resolvedAt: RESOLVING_STATUSES.has(status) ? new Date() : null,
    },
    select: LIST_SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ALERT_STATUS_CHANGED",
    targetType: "Alert",
    targetId: id,
    targetLabel: current.title,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { from: current.status, to: status },
  });

  return toListItem(updated);
}

/** Assign an alert to a user (or unassign with `userId = null`). */
export async function assignAlert(
  id: string,
  userId: string | null,
  actor: MutationActor,
): Promise<AlertListItem | null> {
  const current = await prisma.alert.findUnique({
    where: { id },
    select: { id: true, title: true, assignedToId: true },
  });
  if (!current) return null;

  // Validate the assignee exists and is active before linking.
  let assignee: { id: string; email: string } | null = null;
  if (userId) {
    assignee = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, email: true },
    });
    if (!assignee) return null;
  }

  const updated = await prisma.alert.update({
    where: { id },
    data: { assignedToId: userId },
    select: LIST_SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ALERT_ASSIGNED",
    targetType: "Alert",
    targetId: id,
    targetLabel: current.title,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: {
      from: current.assignedToId,
      to: userId,
      assigneeEmail: assignee?.email ?? null,
    },
  });

  return toListItem(updated);
}

/** Append an analyst note to an alert. */
export async function addAlertNote(
  id: string,
  authorId: string,
  body: string,
  actor: MutationActor,
): Promise<AlertNoteItem | null> {
  const alert = await prisma.alert.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!alert) return null;

  const note = await prisma.alertNote.create({
    data: { alertId: id, authorId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ALERT_NOTE_ADDED",
    targetType: "Alert",
    targetId: id,
    targetLabel: alert.title,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { noteId: note.id, length: body.length },
  });

  return {
    id: note.id,
    body: note.body,
    authorName: note.author.name,
    authorEmail: note.author.email,
    createdAt: note.createdAt,
  };
}
