import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertDetailView } from "@/components/alerts/alert-detail";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { getAlertById, getAssignableUsers } from "@/server/services/alert-service";

export const metadata: Metadata = { title: "Alert · Securis" };

/**
 * /alerts/[id] - Alert detail and investigation view.
 *
 * Server component. Loads the alert with its notes, related events and
 * incidents, plus the list of assignable analysts. `canWrite` is derived from
 * the session role server-side; the actions panel is only a convenience and the
 * API re-checks the permission on every mutation.
 *
 * Connection: server/services/alert-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("alerts:read");

  const { id } = await params;
  const alert = await getAlertById(id);
  if (!alert) notFound();

  const users = await getAssignableUsers();
  const canWrite = hasPermission(session.user.role, "alerts:write");

  return <AlertDetailView alert={alert} users={users} canWrite={canWrite} />;
}
