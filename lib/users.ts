import { DEFAULT_USER_PAGE_SIZE } from "@/lib/validation/users";
import type { UserQuery, UserSortField } from "@/types/users";

/**
 * Securis - User management URL helpers
 *
 * Connection: components/users/** and app/(soc)/users/page.tsx.
 */

export function userQueryToSearchParams(query: Partial<UserQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== DEFAULT_USER_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search) params.set("search", query.search);
  if (query.role && query.role.length > 0) params.set("role", query.role.join(","));
  if (query.active !== undefined) params.set("active", String(query.active));
  if (query.sortBy && query.sortBy !== "name") params.set("sortBy", query.sortBy);
  if (query.sortDir && query.sortDir !== "asc") params.set("sortDir", query.sortDir);

  return params;
}

/** Build a `/users` href from a query plus optional overrides. */
export function buildUsersHref(query: UserQuery, overrides: Partial<UserQuery> = {}): string {
  const params = userQueryToSearchParams({ ...query, ...overrides });
  const qs = params.toString();
  return qs ? `/users?${qs}` : "/users";
}

/** Href that toggles sorting on a column. */
export function buildUserSortHref(query: UserQuery, field: UserSortField): string {
  const isActive = query.sortBy === field;
  const sortDir = isActive && query.sortDir === "asc" ? "desc" : "asc";
  return buildUsersHref(query, { sortBy: field, sortDir, page: 1 });
}
