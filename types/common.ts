/**
 * Securis - Shared types
 *
 * Types used across more than one domain. Kept here so each domain file does
 * not have to depend on another (for example, alerts depending on events just
 * for the pagination envelope).
 */

/** Generic paginated envelope used by every list in Securis. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
