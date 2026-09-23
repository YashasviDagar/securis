import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { runDetection } from "@/server/detection";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";
import { recordAudit } from "@/server/services/audit-service";

/**
 * POST /api/detection/scan
 *
 * Runs the detection engine on demand over a lookback window. Useful for
 * re-evaluating after a rule change, for backfills, and for automated tests.
 *
 * Body (optional): { lookbackSeconds?: number, ruleCodes?: string[] }
 * Requires the `detection:run` permission (ADMIN / SECURITY_ANALYST).
 *
 * Connection: server/detection/engine.ts.
 */

export const runtime = "nodejs";

/** Upper bound on an ad-hoc scan window (7 days). */
const MAX_LOOKBACK_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Request blocked.", 403);
  }

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "detection:run")) {
      return jsonError("Forbidden.", 403);
    }

    // Body is optional; tolerate an empty request.
    let body: { lookbackSeconds?: number; ruleCodes?: string[] } = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as typeof body;
      }
    } catch {
      body = {};
    }

    const lookbackSeconds =
      typeof body.lookbackSeconds === "number" && body.lookbackSeconds > 0
        ? Math.min(body.lookbackSeconds, MAX_LOOKBACK_SECONDS)
        : undefined;
    const ruleCodes = Array.isArray(body.ruleCodes)
      ? body.ruleCodes.filter((code): code is string => typeof code === "string").slice(0, 100)
      : undefined;

    const result = await runDetection({ lookbackSeconds, ruleCodes });

    await recordAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "DETECTION_SCAN",
      targetType: "DetectionEngine",
      targetLabel: "manual-scan",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      metadata: {
        lookbackSeconds: lookbackSeconds ?? null,
        ruleCodes: ruleCodes ?? null,
        rulesEvaluated: result.rulesEvaluated,
        findings: result.findings,
        alertsCreated: result.alertsCreated,
        alertsUpdated: result.alertsUpdated,
      },
    });

    return jsonOk(result);
  } catch (error) {
    console.error("[Securis] detection scan error:", describeError(error));
    return jsonError("An unexpected error occurred during the detection scan.", 500);
  }
}
