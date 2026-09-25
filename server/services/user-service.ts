import { prisma } from "@/database/client";
import type { Prisma, Role } from "@prisma/client";
import { hashPassword } from "@/security/password";
import { recordAudit } from "@/server/services/audit-service";
import { revokeAllUserSessions } from "@/auth/session";
import { ROLES } from "@/types/security";
import type {
  LoginSessionItem,
  UserActivityItem,
  UserDetail,
  UserFacets,
  UserListItem,
  UserQuery,
} from "@/types/users";
import type { Paginated } from "@/types/common";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/users";

/**
 * Securis - User service
 *
 * Account administration for the platform: listing, creation, role changes,
 * enable/disable and the login-history/activity views. Every mutation writes an
 * audit entry. Passwords are hashed with Argon2id and never stored or returned
 * in plaintext.
 *
 * Connection: database/client.ts (User, LoginSession, AuditLog) + security/password.
 */

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface MutationActor {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
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

// -----------------------------------------------------------------------------
// User management (Phase 16)
// -----------------------------------------------------------------------------

const SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { sessions: true, assignedAlerts: true, assignedIncidents: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof SELECT }>;

function toListItem(user: UserRow): UserListItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    sessionCount: user._count.sessions,
    assignedAlerts: user._count.assignedAlerts,
    assignedIncidents: user._count.assignedIncidents,
  };
}

/** Derive a session's display status. */
function sessionStatus(session: {
  revokedAt: Date | null;
  expiresAt: Date;
}): LoginSessionItem["status"] {
  if (session.revokedAt) return "REVOKED";
  if (session.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return "ACTIVE";
}

function buildWhere(query: UserQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const and: Prisma.UserWhereInput[] = [];

  if (query.role.length > 0) where.role = { in: query.role };
  if (query.active !== undefined) where.isActive = query.active;

  if (query.search) {
    const term = query.search;
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** List users with server-side pagination, filtering and sorting. */
export async function listUsers(query: UserQuery): Promise<Paginated<UserListItem>> {
  const where = buildWhere(query);

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: SELECT,
  });

  return { items: rows.map(toListItem), page, pageSize: query.pageSize, total, totalPages };
}

/** Fetch one user with login history and recent activity. */
export async function getUserById(id: string): Promise<UserDetail | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: SELECT });
  if (!user) return null;

  const [sessions, activity] = await Promise.all([
    prisma.loginSession.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetLabel: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
  ]);

  const sessionItems: LoginSessionItem[] = sessions.map((session) => ({
    ...session,
    status: sessionStatus(session),
  }));

  const activityItems: UserActivityItem[] = activity;

  return { ...toListItem(user), sessions: sessionItems, recentActivity: activityItems };
}

/** Distinct filter values. */
export async function getUserFacets(): Promise<UserFacets> {
  return { roles: [...ROLES] };
}

export type WriteResult =
  | { ok: true; user: UserListItem }
  | { ok: false; reason: "DUPLICATE" };

/** Create a user. The password is hashed before it touches the database. */
export async function createUser(
  input: CreateUserInput,
  actor: MutationActor,
): Promise<WriteResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, reason: "DUPLICATE" };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
      isActive: input.isActive,
    },
    select: SELECT,
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "USER_CREATED",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { role: user.role, isActive: user.isActive },
  });

  return { ok: true, user: toListItem(user) };
}

/**
 * Update a user's name, role or active state.
 *
 * Disabling an account immediately revokes every active session, so the user
 * loses access without waiting for the session to expire.
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: MutationActor,
): Promise<WriteResult | null> {
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!current) return null;

  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.role !== undefined) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const user = await prisma.user.update({ where: { id }, data, select: SELECT });

  // Revoke live sessions when an account is disabled.
  if (input.isActive === false && current.isActive) {
    await revokeAllUserSessions(id);
  }

  // Emit a precise audit entry for each aspect that changed.
  const audits: { action: "ROLE_CHANGED" | "USER_ENABLED" | "USER_DISABLED" | "USER_UPDATED"; metadata: Prisma.InputJsonValue }[] = [];

  if (input.role !== undefined && input.role !== current.role) {
    audits.push({
      action: "ROLE_CHANGED",
      metadata: { from: current.role, to: input.role },
    });
  }
  if (input.isActive !== undefined && input.isActive !== current.isActive) {
    audits.push({
      action: input.isActive ? "USER_ENABLED" : "USER_DISABLED",
      metadata: { sessionsRevoked: input.isActive === false },
    });
  }
  if (input.name !== undefined && input.name.trim() !== current.name) {
    audits.push({ action: "USER_UPDATED", metadata: { field: "name" } });
  }
  if (audits.length === 0) {
    audits.push({ action: "USER_UPDATED", metadata: {} });
  }

  for (const audit of audits) {
    await recordAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: audit.action,
      targetType: "User",
      targetId: id,
      targetLabel: user.email,
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
      metadata: audit.metadata,
    });
  }

  return { ok: true, user: toListItem(user) };
}
