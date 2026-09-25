import type { Paginated } from "./common";
import type { Role } from "./security";

/**
 * Securis - User management types
 *
 * Administrator-only surface for accounts, roles, login history and activity.
 * Passwords are never represented in any type here: they only travel one way
 * (into `hashPassword`).
 *
 * Connection: lib/validation/users.ts, server/services/user-service.ts,
 * app/(soc)/users/**, app/api/users/**.
 */

export const USER_SORT_FIELDS = [
  "name",
  "email",
  "role",
  "isActive",
  "lastLoginAt",
  "createdAt",
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export type SortDirection = "asc" | "desc";

/** A fully parsed, validated user query. */
export interface UserQuery {
  page: number;
  pageSize: number;
  search?: string;
  role: Role[];
  active?: boolean;
  sortBy: UserSortField;
  sortDir: SortDirection;
}

/** A single row in the user table. */
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  sessionCount: number;
  assignedAlerts: number;
  assignedIncidents: number;
}

/** A login session as shown in the user's history. */
export interface LoginSessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Derived status for display. */
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

/** A recent audit entry attributed to the user. */
export interface UserActivityItem {
  id: string;
  action: string;
  targetType: string | null;
  targetLabel: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

/** The full user record shown on the detail page. */
export interface UserDetail extends UserListItem {
  sessions: LoginSessionItem[];
  recentActivity: UserActivityItem[];
}

/** Distinct values used to populate the user filter dropdowns. */
export interface UserFacets {
  roles: Role[];
}

export type { Paginated };
