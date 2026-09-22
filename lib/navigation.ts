import {
  Bell,
  BookOpen,
  FileSearch,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Siren,
  Users,
} from "lucide-react";
import type { NavGroup } from "@/types/navigation";

/**
 * Securis - Sidebar navigation model
 *
 * Single source of truth for the SOC console navigation. Both the sidebar and
 * the header consume this structure, and each page uses its entry to render a
 * consistent title/description.
 *
 * `phase` documents when a module becomes functional. It is surfaced in the UI
 * as an honest "arrives in Phase N" empty state, so no screen ever shows fake
 * security statistics.
 *
 * Connection: consumed by components/layout/sidebar.tsx and
 * components/layout/header.tsx. In Phase 3 the `allowedRoles` field becomes
 * enforceable against the authenticated session.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Live security posture, trends and recent detections.",
        phase: 13,
      },
      {
        title: "Global Search",
        href: "/search",
        icon: FileSearch,
        description: "Search across events, alerts, incidents, indicators and users.",
        phase: 17,
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        title: "Events",
        href: "/events",
        icon: ScrollText,
        description: "Normalised security events collected from all sources.",
        phase: 5,
      },
      {
        title: "Alerts",
        href: "/alerts",
        icon: Bell,
        description: "Detections raised by the detection engine.",
        phase: 9,
      },
      {
        title: "Incidents",
        href: "/incidents",
        icon: Siren,
        description: "Coordinated investigations built from related alerts.",
        phase: 10,
      },
    ],
  },
  {
    label: "Detection",
    items: [
      {
        title: "Detection Rules",
        href: "/detection-rules",
        icon: ShieldAlert,
        description: "Rules the detection engine evaluates against every event.",
        phase: 12,
        allowedRoles: ["ADMIN"],
        requiredPermission: "rules:write",
      },
      {
        title: "Threat Intelligence",
        href: "/threat-intelligence",
        icon: Shield,
        description: "Known malicious IPs, domains, hashes and URLs.",
        phase: 11,
      },
      {
        title: "Attack Simulation",
        href: "/simulation",
        icon: BookOpen,
        description: "Safely generate controlled attack traffic against local test data.",
        phase: 14,
        allowedRoles: ["ADMIN", "SECURITY_ANALYST"],
        requiredPermission: "simulation:run",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users",
        href: "/users",
        icon: Users,
        description: "Analyst accounts, roles and login activity.",
        phase: 16,
        allowedRoles: ["ADMIN"],
        requiredPermission: "users:read",
      },
      {
        title: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
        description: "Immutable record of every privileged action in Securis.",
        phase: 15,
        allowedRoles: ["ADMIN"],
        requiredPermission: "audit:read",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Platform configuration and personal preferences.",
        phase: 18,
      },
    ],
  },
];

/** Flat list of every navigation item, handy for lookups by href. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** Find the navigation entry that matches a given pathname. */
export function findNavItem(pathname: string) {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/**
 * Like `findNavItem`, but throws when the entry is missing. Pages call this so
 * their title/description/phase always stay in sync with the navigation model
 * instead of duplicating the strings.
 */
export function requireNavItem(href: string) {
  const item = NAV_ITEMS.find((entry) => entry.href === href);
  if (!item) {
    throw new Error(`Navigation item for "${href}" is not defined.`);
  }
  return item;
}
