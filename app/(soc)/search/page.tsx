import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  FileSearch,
  ScrollText,
  Search as SearchIcon,
  Shield,
  Siren,
  Users as UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/auth/current-user";
import { globalSearch } from "@/server/services/search-service";
import { formatDateTime, formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "Global Search · Securis" };

/**
 * /search - Global security search.
 *
 * Server component. One term is applied across events, alerts, incidents,
 * threat indicators and users; each group shows a short preview plus the total,
 * with a link into the module's own explorer for the full, paginated list.
 *
 * Connection: server/services/search-service.ts.
 */

export const dynamic = "force-dynamic";

/** Build the "view all" href for a module, preserving the search term. */
function viewAllHref(base: string, term: string): string {
  return `${base}?search=${encodeURIComponent(term)}`;
}

/** A group heading with a "view all" link. */
function GroupHeader({
  title,
  total,
  href,
  icon: Icon,
}: {
  title: string;
  total: number;
  href: string;
  icon: typeof Bell;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
        <span className="font-mono text-xs text-muted-foreground">({formatNumber(total)})</span>
      </h2>
      {total > 0 ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>View all</Link>
        </Button>
      ) : null}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("events:read");

  const params = await searchParams;
  const raw = params.q;
  const term = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const results = term ? await globalSearch(term, session.user.role) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Global Search"
        description="Search across events, alerts, incidents, threat indicators and users."
      />

      <form method="get" action="/search" className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              type="search"
              defaultValue={term}
              placeholder="IP address, username, event type, rule code, incident reference…"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
          <Button type="submit" size="sm" className="h-9">
            Search
          </Button>
        </div>
        <p className="mt-2 text-[0.68rem] text-muted-foreground">
          Examples: <span className="font-mono">192.168.1.50</span> ·{" "}
          <span className="font-mono">admin</span> · <span className="font-mono">LOGIN_FAILED</span> ·{" "}
          <span className="font-mono">BRUTE_FORCE</span> ·{" "}
          <span className="font-mono">INC-2026-001</span>
        </p>
      </form>

      {!term ? (
        <EmptyState
          icon={FileSearch}
          title="Search the security data"
          description="Enter a term above to search across every entity in Securis."
        />
      ) : !results || results.totalMatches === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={`No matches for “${term}”`}
          description="Try a different term — an IP address, username, event type or rule code."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {formatNumber(results.totalMatches)} matches for{" "}
            <span className="font-mono text-foreground">{term}</span>
          </p>

          {/* Events */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <GroupHeader
              title="Events"
              total={results.events.total}
              href={viewAllHref("/events", term)}
              icon={ScrollText}
            />
            {results.events.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching events.</p>
            ) : (
              <ul className="space-y-1.5">
                {results.events.items.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/events/${event.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {event.eventType}
                    </Link>
                    <SeverityBadge severity={event.severity} />
                    <span className="font-mono text-[0.68rem] text-muted-foreground">
                      {formatDateTime(event.timestamp)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {event.message}
                      {event.sourceIp ? ` (${event.sourceIp})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Alerts */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <GroupHeader
              title="Alerts"
              total={results.alerts.total}
              href={viewAllHref("/alerts", term)}
              icon={Bell}
            />
            {results.alerts.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching alerts.</p>
            ) : (
              <ul className="space-y-1.5">
                {results.alerts.items.map((alert) => (
                  <li key={alert.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/alerts/${alert.id}`}
                      className="text-primary hover:underline"
                    >
                      {alert.title}
                    </Link>
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                    <span className="font-mono text-[0.68rem] text-muted-foreground">
                      risk {alert.riskScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Incidents */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <GroupHeader
              title="Incidents"
              total={results.incidents.total}
              href={viewAllHref("/incidents", term)}
              icon={Siren}
            />
            {results.incidents.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching incidents.</p>
            ) : (
              <ul className="space-y-1.5">
                {results.incidents.items.map((incident) => (
                  <li key={incident.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="text-primary hover:underline"
                    >
                      <span className="font-mono text-xs">{incident.reference}</span> · {incident.title}
                    </Link>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Threat indicators */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <GroupHeader
              title="Threat indicators"
              total={results.indicators.total}
              href={viewAllHref("/threat-intelligence", term)}
              icon={Shield}
            />
            {results.indicators.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching indicators.</p>
            ) : (
              <ul className="space-y-1.5">
                {results.indicators.items.map((indicator) => (
                  <li key={indicator.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] text-foreground">
                      {indicator.type}
                    </span>
                    <span className="font-mono text-xs break-all text-foreground">
                      {indicator.value}
                    </span>
                    <span className="text-muted-foreground">{indicator.threatType ?? "—"}</span>
                    <span className="font-mono text-[0.68rem] text-muted-foreground">
                      confidence {indicator.confidence}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Users (only when permitted) */}
          {results.users ? (
            <section className="rounded-xl border border-border/60 bg-card/40 p-4">
              <GroupHeader
                title="Users"
                total={results.users.total}
                href={viewAllHref("/users", term)}
                icon={UsersIcon}
              />
              {results.users.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching users.</p>
              ) : (
                <ul className="space-y-1.5">
                  {results.users.items.map((user) => (
                    <li key={user.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/users/${user.id}`} className="text-primary hover:underline">
                        {user.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
                      <span className="text-muted-foreground">{user.role}</span>
                      {!user.isActive ? (
                        <span className="text-[0.68rem] text-severity-high">disabled</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
