import { z } from "zod";
import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { runSimulation } from "@/server/simulation/service";
import { recordAudit } from "@/server/services/audit-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";
import { SIMULATION_SCENARIOS } from "@/types/simulation";

/**
 * POST /api/simulation
 *
 * Runs a controlled attack-simulation scenario against Securis' own test data.
 * Requires `simulation:run` (ADMIN / SECURITY_ANALYST).
 *
 * The events flow through the real ingestion + detection pipeline, so the lab
 * demonstrates that the SIEM genuinely works end to end.
 *
 * Connection: server/simulation/service.ts -> server/ingestion/pipeline.ts.
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  scenario: z.enum(SIMULATION_SCENARIOS),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "simulation:run")) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Unknown simulation scenario.", 400);
    }

    const result = await runSimulation(
      parsed.data.scenario,
      { type: "user", userId: session.user.id, email: session.user.email },
      { ipAddress: getClientIp(request), userAgent: getUserAgent(request) },
    );

    await recordAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "SIMULATION_RUN",
      targetType: "Simulation",
      targetLabel: parsed.data.scenario,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      metadata: {
        accepted: result.accepted,
        alertsCreated: result.alertsCreated,
        alertsUpdated: result.alertsUpdated,
      },
    });

    return jsonOk(result, { status: 202 });
  } catch (error) {
    console.error("[Securis] simulation error:", describeError(error));
    return jsonError("An unexpected error occurred during the simulation.", 500);
  }
}
