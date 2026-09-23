import { prisma } from "@/database/client";
import type { Role } from "@prisma/client";

/**
 * Securis - User service
 *
 * Read helpers for user data used by other domains (alert and incident
 * assignment today; the full user management surface arrives in Phase 16).
 * Keeping these here avoids duplicating user queries across services.
 *
 * Connection: database/client.ts (User).
 */

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Active users who can be assigned alerts or incidents. */
export async function getAssignableUsers(): Promise<AssignableUser[]> {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** Look up a single active user by id (used to validate assignments). */
export async function findActiveUser(
  id: string,
): Promise<{ id: string; name: string; email: string } | null> {
  return prisma.user.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true, email: true },
  });
}
