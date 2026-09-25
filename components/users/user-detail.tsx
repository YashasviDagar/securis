import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/format";
import type { Role } from "@/types/security";
import type { UserDetail } from "@/types/users";

/**
 * Securis - User detail view
 *
 * Server component showing an account's profile, login history and recent
 * activity (the audit entries it produced).
 *
 * Connection: app/(soc)/users/[id]/page.tsx.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

const SESSION_STYLES: Record<string, string> = {
  ACTIVE: "bg-severity-low/15 text-severity-low ring-severity-low/30",
  EXPIRED: "bg-muted text-muted-foreground ring-border",
  REVOKED: "bg-severity-high/15 text-severity-high ring-severity-high/30",
};

export function UserDetailView({
  user,
  canWrite,
}: {
  user: UserDetail;
  canWrite: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/users">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to users
            </Link>
          </Button>
          <UserFormDialog
            canWrite={canWrite}
            user={user}
            trigger={
              <Button size="sm" variant="outline">
                Edit user
              </Button>
            }
          />
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-foreground">{user.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{user.email}</p>
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Account</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="User ID">
            <span className="font-mono text-xs break-all">{user.id}</span>
          </Fact>
          <Fact label="Role">{user.role as Role}</Fact>
          <Fact label="Status">{user.isActive ? "Active" : "Disabled"}</Fact>
          <Fact label="Last login">
            <span className="font-mono text-xs">{formatDateTime(user.lastLoginAt)}</span>
          </Fact>
          <Fact label="Created">
            <span className="font-mono text-xs">{formatDateTime(user.createdAt)}</span>
          </Fact>
          <Fact label="Assigned alerts">{user.assignedAlerts}</Fact>
          <Fact label="Assigned incidents">{user.assignedIncidents}</Fact>
          <Fact label="Sessions">{user.sessionCount}</Fact>
        </dl>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Login history ({user.sessions.length})
        </h2>
        {user.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/50 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">User agent</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {user.sessions.map((session) => (
                  <tr key={session.id} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium ring-1 ring-inset ${SESSION_STYLES[session.status]}`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {session.ipAddress ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                      {session.userAgent ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {formatDateTime(session.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {formatDateTime(session.lastSeenAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {formatDateTime(session.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Recent activity ({user.recentActivity.length})
        </h2>
        {user.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ul className="space-y-2">
            {user.recentActivity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-2 text-xs"
              >
                <span className="font-mono text-foreground">{entry.action}</span>
                <span className="truncate text-muted-foreground">
                  {entry.targetType ?? "—"}
                  {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                </span>
                <span className="font-mono text-muted-foreground">
                  {entry.ipAddress ?? "—"} · {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
