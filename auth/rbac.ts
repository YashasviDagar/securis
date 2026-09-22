import type { Role } from "@/types/security";

/**
 * Securis - Role-Based Access Control (RBAC)
 *
 * The authoritative permission model. It is deliberately a pure, dependency-free
 * module so it can be used from server components, route handlers and tests
 * without side effects.
 *
 * IMPORTANT: this file defines WHAT a role may do. It is enforced exclusively
 * on the server (see auth/current-user.ts and the API route handlers). Hiding a
 * button in the UI is a convenience, never a security control.
 */

/** Every discrete capability in the platform. */
export const PERMISSIONS = [
  // Read capabilities
  "dashboard:read",
  "events:read",
  "alerts:read",
  "incidents:read",
  "rules:read",
  "threat-intel:read",
  "audit:read",
  "users:read",
  // Write capabilities
  "alerts:write",
  "incidents:write",
  "rules:write",
  "threat-intel:write",
  "users:write",
  "audit:write",
  // Operations
  "events:ingest",
  "simulation:run",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permission grants per role.
 *
 * VIEWER          - read-only across the console.
 * SECURITY_ANALYST- everything a viewer can do, plus investigating alerts,
 *                   managing incidents, maintaining threat intel and running
 *                   simulations.
 * ADMIN           - full control, including users, detection rules and audit.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  SECURITY_ANALYST: [
    "dashboard:read",
    "events:read",
    "events:ingest",
    "alerts:read",
    "alerts:write",
    "incidents:read",
    "incidents:write",
    "rules:read",
    "threat-intel:read",
    "threat-intel:write",
    "audit:write",
    "simulation:run",
  ],
  VIEWER: [
    "dashboard:read",
    "events:read",
    "alerts:read",
    "incidents:read",
    "rules:read",
    "threat-intel:read",
  ],
};

/** Does the given role hold the given permission? */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Does the given role hold *all* of the given permissions? */
export function hasAllPermissions(
  role: Role,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/** Human-readable capability summary, used by the user management screen. */
export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  ADMIN: [
    "Manage users and roles",
    "Create and manage detection rules",
    "View and edit alerts",
    "Manage incidents",
    "View audit logs",
    "View all events",
  ],
  SECURITY_ANALYST: [
    "View events",
    "Investigate and update alerts",
    "Manage incidents",
    "View and maintain threat intelligence",
  ],
  VIEWER: ["Read-only access to events, alerts, incidents and intelligence"],
};
