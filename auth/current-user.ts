import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "./constants";
import { validateSessionToken } from "./session";
import { hasPermission, type Permission } from "./rbac";
import type { AuthSession, SessionUser } from "@/types/auth";

/**
 * Securis - Current user / authorization guards
 *
 * Server-only helpers that read the session cookie and enforce authorization.
 * These are the functions pages and server components use; the API routes use
 * the lower-level helpers plus explicit permission checks.
 *
 * IMPORTANT: `requirePermission` is the authoritative gate. UI hiding is a
 * convenience layered on top of it, never a replacement.
 *
 * Connection: next/headers (cookie), auth/session.ts (validation),
 * auth/rbac.ts (permission model).
 */

/** Read and validate the session for the current request. Null when absent. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/** The authenticated user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * Require an authenticated session, redirecting to /login otherwise.
 * The return type is non-null because `redirect()` never returns.
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require a specific permission. Unauthenticated users go to /login; an
 * authenticated user lacking the permission is sent back to the dashboard with
 * a marker the UI can surface.
 */
export async function requirePermission(permission: Permission): Promise<AuthSession> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    redirect(`/dashboard?denied=${encodeURIComponent(permission)}`);
  }
  return session;
}
