import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserDetailView } from "@/components/users/user-detail";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { getUserById } from "@/server/services/user-service";

export const metadata: Metadata = { title: "User · Securis" };

/**
 * /users/[id] - User detail.
 *
 * Server component. Shows the account, its login history and recent activity.
 * Administrator-only.
 *
 * Connection: server/services/user-service.ts (getUserById).
 */

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("users:read");

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const canWrite = hasPermission(session.user.role, "users:write");

  return <UserDetailView user={user} canWrite={canWrite} />;
}
