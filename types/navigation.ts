import type { LucideIcon } from "lucide-react";
import type { Role } from "./security";

/**
 * Securis - Navigation types
 *
 * Describes the shape of a sidebar navigation entry. The actual entries live in
 * `lib/navigation.ts` so that the data is separated from the presentational
 * components (Sidebar/Header), keeping business/config logic out of the UI.
 */
export interface NavItem {
  /** Label shown in the sidebar and header breadcrumb. */
  title: string;
  /** Route the entry links to. */
  href: string;
  /** Lucide icon component rendered next to the label. */
  icon: LucideIcon;
  /** Short description used by the page header and empty states. */
  description: string;
  /**
   * Roles allowed to see this entry. `undefined` means every authenticated
   * user can see it. This is only a UX hint: the authoritative check happens
   * server-side in Phase 3 and beyond.
   */
  allowedRoles?: readonly Role[];
  /**
   * Build phase in which this module becomes fully functional. Until then the
   * page renders an explicit "not yet implemented" empty state rather than
   * fabricated data.
   */
  phase: number;
}

/** A logical group of navigation entries rendered under a shared heading. */
export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}
