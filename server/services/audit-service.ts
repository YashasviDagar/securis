import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/database/client";

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
