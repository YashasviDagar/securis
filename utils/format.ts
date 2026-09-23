/**
 * Securis - Formatting helpers
 *
 * Deterministic display formatting for the SOC UI. Timestamps are rendered in
 * UTC so server-rendered markup is stable regardless of the host timezone.
 *
 * Connection: used by the event explorer, alert and incident views.
 */

/** Format a date as `YYYY-MM-DD HH:mm:ss` in UTC. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  );
}

/** Format a date as `YYYY-MM-DD` in UTC (for date inputs and headers). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Format a value as a `datetime-local` input value (UTC, minute precision).
 * Used to round-trip the date-range filter.
 */
export function formatDateTimeLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

/**
 * Format a value as a `YYYY-MM-DD` date-input value, or "" when absent/invalid.
 * Used to round-trip the event date-range filter.
 */
export function formatDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Compact integer formatting (e.g. 1,234). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Human-readable label for enum values (`SECURITY_ANALYST` -> `Security analyst`). */
export function humanizeEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
