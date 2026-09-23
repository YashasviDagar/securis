import { z } from "zod";
import { getCurrentSession } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { addAlertNote } from "@/server/services/alert-service";
import {
  describeError,
  getClientIp,
  getUserAgent,
  isSameOrigin,
  jsonError,
  jsonOk,
} from "@/server/http/request";

/**
 * POST /api/alerts/[id]/notes
 *
 * Appends an analyst note to an alert. Requires `alerts:write`.
 *
 * Connection: server/services/alert-service.ts (addAlertNote).
 */

export const runtime = "nodejs";

const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty.").max(4000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);

  try {
    const session = await getCurrentSession();
    if (!session) return jsonError("Not authenticated.", 401);
    if (!hasPermission(session.user.role, "alerts:write")) {
      return jsonError("Forbidden.", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid input.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const note = await addAlertNote(id, session.user.id, parsed.data.body, {
      id: session.user.id,
      email: session.user.email,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!note) return jsonError("Alert not found.", 404);
    return jsonOk(note, { status: 201 });
  } catch (error) {
    console.error("[Securis] alert note error:", describeError(error));
    return jsonError("An unexpected error occurred.", 500);
  }
}
