import type { Metadata } from "next";
import Link from "next/link";
import { Users as UsersIcon, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { UserFilters } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { requirePermission } from "@/auth/current-user";
import { hasPermission } from "@/auth/rbac";
import { parseUserQuery } from "@/lib/validation/users";
import { buildUsersHref } from "@/lib/users";
import { getUserFacets, listUsers } from "@/server/services/user-service";

export const metadata: Metadata = { title: "Users · Securis" };

/**
 * /users - User management.
 *
 * Server component. Administrators can create accounts, change roles and
 * enable/disable users. Disabling revokes the account's sessions immediately.
 * Every action is audit-logged.
 *
 * Authorization: `requirePermission("users:read")`; mutations additionally
 * require `users:write` (enforced by the API; the create/edit controls are only
 * rendered for writers).
 *
 * Connection: lib/validation/users.ts -> server/services/user-service.ts.
 */

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("users:read");

  const params = await searchParams;
  const query = parseUserQuery(params);

  const result = await listUsers(query);
  const facets = await getUserFacets();
  const canWrite = hasPermission(session.user.role, "users:write");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Analyst and administrator accounts, roles and login activity."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </span>
            <UserFormDialog
              canWrite={canWrite}
              trigger={
                <Button size="sm">
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Create user
                </Button>
              }
            />
          </div>
        }
      />

      <UserFilters query={query} facets={facets} />

      {result.total === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users match these filters"
          description="Create a user or clear the filters."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/users">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <UserTable users={result.items} query={query} canWrite={canWrite} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(page) => buildUsersHref(query, { page })}
            label="users"
          />
        </>
      )}
    </div>
  );
}
