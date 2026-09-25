import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { UserRowActions } from "@/components/users/user-row-actions";
import { buildUserSortHref } from "@/lib/users";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { Role } from "@/types/security";
import type { UserListItem, UserQuery, UserSortField } from "@/types/users";

/**
 * Securis - User table
 *
 * Server component rendering one page of accounts with sortable columns and
 * per-row actions.
 *
 * Connection: app/(soc)/users/page.tsx.
 */

interface Column {
  label: string;
  sortKey?: UserSortField;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "Name", sortKey: "name", className: "w-[170px]" },
  { label: "Email", sortKey: "email", className: "min-w-[210px]" },
  { label: "Role", sortKey: "role", className: "w-[160px]" },
  { label: "Status", sortKey: "isActive", className: "w-[100px]" },
  { label: "Last login", sortKey: "lastLoginAt", className: "w-[190px]" },
  { label: "Sessions", className: "w-[90px]" },
  { label: "Alerts", className: "w-[80px]" },
  { label: "Incidents", className: "w-[90px]" },
  { label: "Created", sortKey: "createdAt", className: "w-[190px]" },
  { label: "Actions", className: "w-[100px]" },
];

/** Colour a role by its privilege level. */
function roleClass(role: Role): string {
  if (role === "ADMIN") return "bg-severity-critical/15 text-severity-critical ring-severity-critical/30";
  if (role === "SECURITY_ANALYST") return "bg-severity-info/15 text-severity-info ring-severity-info/30";
  return "bg-muted text-muted-foreground ring-border";
}

function SortHeader({ column, query }: { column: Column; query: UserQuery }) {
  const isActive = column.sortKey === query.sortBy;
  return (
    <Link
      href={buildUserSortHref(query, column.sortKey!)}
      className={cn("inline-flex items-center gap-1 hover:text-foreground", isActive && "text-foreground")}
    >
      {column.label}
      {isActive ? (
        query.sortDir === "asc" ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )
      ) : null}
    </Link>
  );
}

export function UserTable({
  users,
  query,
  canWrite,
}: {
  users: UserListItem[];
  query: UserQuery;
  canWrite: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1200px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            {COLUMNS.map((column) => (
              <th key={column.label} className={cn("px-3 py-2 font-medium", column.className)}>
                {column.sortKey ? <SortHeader column={column} query={query} /> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/users/${user.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {user.name}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{user.email}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium ring-1 ring-inset",
                    roleClass(user.role),
                  )}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium ring-1 ring-inset",
                    user.isActive
                      ? "bg-severity-low/15 text-severity-low ring-severity-low/30"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {user.isActive ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(user.lastLoginAt)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {user.sessionCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {user.assignedAlerts}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {user.assignedIncidents}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {formatDateTime(user.createdAt)}
              </td>
              <td className="px-3 py-2">
                <UserRowActions user={user} canWrite={canWrite} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
