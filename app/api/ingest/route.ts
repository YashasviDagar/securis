import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { ingestPayloadSchema, toRawEventArray } from "@/lib/validation/ingestion";
import { ingestEvents } from "@/server/ingestion/pipeline";
import { consumeRateLimit } from "@/server/http/rate-limit";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
  safeEqual,
} from "@/server/http/request";
import type { IngestionActor } from "@/types/ingestion";

/**
 * POST /api/ingest
 *
 * Machine-to-machine endpoint that feeds security events into the pipeline.
 * Supports web applications, authentication systems, APIs, servers and
 * simulated infrastructure.
 *
 * Authentication - one of:
 *   1. `X-Ingest-Key: <INGEST_API_KEY>` header (collectors).
 *   2. An authenticated session whose role holds the `events:ingest`
 *      permission (ADMIN / SECURITY_ANALYST).
 * Anything else is rejected with 401. The endpoint never trusts the payload:
 * Zod validates the shape and the pipeline performs semantic validation.
 *
 * Connection: lib/validation/ingestion.ts -> server/ingestion/pipeline.ts.
 */

export const runtime = "nodejs";

/** Generic ingestion rate limit (see .env.example). */
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX ?? "120");
const API_RATE_LIMIT_WINDOW_SECONDS = Number(
  process.env.API_RATE_LIMIT_WINDOW_SECONDS ?? "60",
);

/**
 * Resolve the caller's identity. Returns null when the request is not
 * authorised to ingest.
 */
async function resolveActor(request: Request): Promise<IngestionActor | null> {
  // 1. API key path (machine clients).
  const providedKey = request.headers.get("x-ingest-key");
  const expectedKey = process.env.INGEST_API_KEY;
  if (providedKey && expectedKey && safeEqual(providedKey, expectedKey)) {
    return { type: "api-key", label: "ingest-api-key" };
  }

  // 2. Authenticated session with the ingest permission.
  const session = await getCurrentSession();
  if (session && hasPermission(session.user.role, "events:ingest")) {
    return { type: "user", userId: session.user.id, email: session.user.email };
  }

  return null;
}

export async function POST(request: Request) {
  // Block cross-site browser posts. Machine clients send no Origin/Referer and
  // are unaffected; browsers with a session are protected against CSRF.
  if (!isSameOrigin(request)) {
    return jsonError("Request blocked.", 403);
  }

  const actor = await resolveActor(request);
  if (!actor) {
    // Do not reveal whether a key was configured or which scheme was expected.
    return jsonError("Unauthorized.", 401);
  }

  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  const limit = consumeRateLimit(
    `ingest:ip:${ipAddress}`,
    API_RATE_LIMIT_MAX,
    API_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return jsonError("Rate limit exceeded. Please retry later.", 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid event payload.", 400, {
      issues: parsed.error.issues.slice(0, 25).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const rawEvents = toRawEventArray(parsed.data);
    const result = await ingestEvents(rawEvents, actor, { ipAddress, userAgent });

    // 202 Accepted: the events were validated and persisted. 400 when every
    // event in the batch was rejected, so collectors can distinguish the cases.
    const status = result.accepted === 0 && result.rejected > 0 ? 400 : 202;
    return jsonOk(result, { status });
  } catch (error) {
    console.error("[Securis] ingestion error:", describeError(error));
    return jsonError("An unexpected error occurred while ingesting events.", 500);
  }
}
