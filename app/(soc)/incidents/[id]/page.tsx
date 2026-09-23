import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncidentDetailView } from "@/components/incidents/incident-detail";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { getIncidentById } from "@/server/services/incident-service";
import { getAssignableUsers } from "@/server/services/user-service";

export const metadata: Metadata = { title: "Incident · Securis" };

/**
 * /incidents/[id] - Incident investigation view.
 *
 * Server component. Loads the incident with its alerts, related events and
 * notes, plus the assignable analysts. `canWrite` is derived server-side.
 *
 * Connection: server/services/incident-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("incidents:read");

  const { id } = await params;
  const incident = await getIncidentById(id);
  if (!incident) notFound();

  const users = await getAssignableUsers();
  const canWrite = hasPermission(session.user.role, "incidents:write");

  return <IncidentDetailView incident={incident} users={users} canWrite={canWrite} />;
}
