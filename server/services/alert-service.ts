import type { AlertStatus, Prisma, Severity } from "@prisma/client";
import { prisma } from "@/database/client";
import { recordAudit } from "@/server/services/audit-service";
import type { DetectionFinding } from "@/types/detection";

/**
 * Securis - Alert service
 *
 * Persistence for alerts. The detection engine calls `upsertAlertFromFinding`,
 * which is idempotent via the finding's `dedupeKey`:
 *
 *   - if an alert with the same key exists, its `lastSeen`, risk score and
 *     related events are refreshed (no duplicate alert);
 *   - otherwise a new alert is created and an `ALERT_CREATED` audit entry is
 *     written.
 *
 * Alert lifecycle management (assignment, status changes, notes) is built on
 * top of this in Phase 9.
 *
 * Connection: database/client.ts -> Alert (+ Alert<->SecurityEvent relation).
 */

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
 * Create or refresh an alert for a detection finding.
 */
export async function upsertAlertFromFinding(
  finding: DetectionFinding,
): Promise<UpsertAlertResult> {
  // Only connect events when there are any (an empty connect array is invalid).
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
