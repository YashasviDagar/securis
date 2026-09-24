import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import { recordAudit } from "@/server/services/audit-service";
import { RULE_TYPES, SEVERITIES } from "@/types/security";
import type { RuleDetail, RuleFacets, RuleListItem, RuleQuery } from "@/types/rules";
import type { Paginated } from "@/types/common";
import type { CreateRuleInput, UpdateRuleInput } from "@/lib/validation/rules";

/**
 * Securis - Detection rule service
 *
 * CRUD for the rules the detection engine evaluates. Because rules live in the
 * database, changes take effect on the next detection run with no deployment.
 *
 * Connection: database/client.ts (DetectionRule) + audit-service.
 */

export interface MutationActor {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  ruleType: true,
  severity: true,
  threshold: true,
  timeWindowSeconds: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { alerts: true } },
} satisfies Prisma.DetectionRuleSelect;

type RuleRow = Prisma.DetectionRuleGetPayload<{ select: typeof SELECT }>;

function toListItem(rule: RuleRow): RuleListItem {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    description: rule.description,
    ruleType: rule.ruleType,
    severity: rule.severity,
    threshold: rule.threshold,
    timeWindowSeconds: rule.timeWindowSeconds,
    enabled: rule.enabled,
    createdBy: rule.createdBy ?? null,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    alertCount: rule._count.alerts,
  };
}

/** Build the Prisma `where` clause for a rule query. */
function buildWhere(query: RuleQuery): Prisma.DetectionRuleWhereInput {
  const where: Prisma.DetectionRuleWhereInput = {};
  const and: Prisma.DetectionRuleWhereInput[] = [];

  if (query.severity.length > 0) where.severity = { in: query.severity };
  if (query.ruleType.length > 0) where.ruleType = { in: query.ruleType };
  if (query.enabled !== undefined) where.enabled = query.enabled;

  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { code: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List rules with server-side pagination, filtering and sorting. */
export async function listRules(query: RuleQuery): Promise<Paginated<RuleListItem>> {
  const where = buildWhere(query);

  const total = await prisma.detectionRule.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.detectionRule.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: SELECT,
  });

  return { items: rows.map(toListItem), page, pageSize: query.pageSize, total, totalPages };
}

/** Fetch one rule with its condition and most recent alerts. */
export async function getRuleById(id: string): Promise<RuleDetail | null> {
  const rule = await prisma.detectionRule.findUnique({
    where: { id },
    select: {
      ...SELECT,
      condition: true,
      alerts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          riskScore: true,
          createdAt: true,
        },
      },
    },
  });

  if (!rule) return null;

  const { condition, alerts, ...rest } = rule;
  return { ...toListItem(rest as RuleRow), condition, recentAlerts: alerts };
}

/** Distinct filter values drawn from real data. */
export async function getRuleFacets(): Promise<RuleFacets> {
  return { severities: [...SEVERITIES], ruleTypes: [...RULE_TYPES] };
}

export type WriteResult =
  | { ok: true; rule: RuleListItem }
  | { ok: false; reason: "DUPLICATE" };

/** Create a detection rule. */
export async function createRule(
  input: CreateRuleInput,
  actor: MutationActor,
): Promise<WriteResult> {
  const existing = await prisma.detectionRule.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "DUPLICATE" };

  const rule = await prisma.detectionRule.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      severity: input.severity,
      condition: input.condition as Prisma.InputJsonValue,
      threshold: input.threshold ?? null,
      timeWindowSeconds: input.timeWindowSeconds ?? null,
      enabled: input.enabled,
      createdById: actor.id,
    },
    select: SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "RULE_CREATED",
    targetType: "DetectionRule",
    targetId: rule.id,
    targetLabel: rule.code,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { ruleType: rule.ruleType, severity: rule.severity, enabled: rule.enabled },
  });

  return { ok: true, rule: toListItem(rule) };
}

/** Update a rule (content, condition, threshold, window, severity). */
export async function updateRule(
  id: string,
  input: UpdateRuleInput,
  actor: MutationActor,
): Promise<WriteResult | null> {
  const current = await prisma.detectionRule.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!current) return null;

  if (input.code && input.code !== current.code) {
    const duplicate = await prisma.detectionRule.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (duplicate) return { ok: false, reason: "DUPLICATE" };
  }

  const data: Prisma.DetectionRuleUpdateInput = {};
  if (input.code !== undefined) data.code = input.code;
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.ruleType !== undefined) data.ruleType = input.ruleType;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.condition !== undefined) data.condition = input.condition as Prisma.InputJsonValue;
  if (input.threshold !== undefined) data.threshold = input.threshold;
  if (input.timeWindowSeconds !== undefined) data.timeWindowSeconds = input.timeWindowSeconds;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  const rule = await prisma.detectionRule.update({ where: { id }, data, select: SELECT });

  // Choose the most precise audit action: a change that only flips `enabled` is
  // recorded as RULE_ENABLED / RULE_DISABLED rather than a generic update.
  const onlyEnabled =
    input.enabled !== undefined &&
    input.code === undefined &&
    input.name === undefined &&
    input.description === undefined &&
    input.ruleType === undefined &&
    input.severity === undefined &&
    input.condition === undefined &&
    input.threshold === undefined &&
    input.timeWindowSeconds === undefined;

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: onlyEnabled ? (rule.enabled ? "RULE_ENABLED" : "RULE_DISABLED") : "RULE_UPDATED",
    targetType: "DetectionRule",
    targetId: id,
    targetLabel: rule.code,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { ruleType: rule.ruleType, severity: rule.severity, enabled: rule.enabled },
  });

  return { ok: true, rule: toListItem(rule) };
}

/** Delete a rule. Alerts it produced keep their history (ruleId set to null). */
export async function deleteRule(id: string, actor: MutationActor): Promise<boolean> {
  const current = await prisma.detectionRule.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!current) return false;

  await prisma.detectionRule.delete({ where: { id } });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "RULE_DELETED",
    targetType: "DetectionRule",
    targetId: id,
    targetLabel: current.code,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { code: current.code },
  });

  return true;
}
