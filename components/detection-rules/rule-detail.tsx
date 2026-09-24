import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RuleFormDialog } from "@/components/detection-rules/rule-form-dialog";
import { SeverityBadge, StatusBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/format";
import type { RuleDetail } from "@/types/rules";

/**
 * Securis - Detection rule detail view
 *
 * Server component showing the full rule: metadata, the raw condition document
 * (so an administrator can see exactly what the engine evaluates) and the most
 * recent alerts it produced.
 *
 * Connection: app/(soc)/detection-rules/[id]/page.tsx.
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

export function RuleDetailView({
  rule,
  canWrite,
}: {
  rule: RuleDetail;
  canWrite: boolean;
}) {
  let conditionJson: string;
  try {
    conditionJson = JSON.stringify(rule.condition, null, 2);
  } catch {
    conditionJson = "{}";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/detection-rules">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to rules
            </Link>
          </Button>
          <RuleFormDialog
            canWrite={canWrite}
            rule={rule}
            condition={rule.condition as Record<string, unknown>}
            trigger={
              <Button size="sm" variant="outline">
                Edit rule
              </Button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
            {rule.code}
          </span>
          <SeverityBadge severity={rule.severity} />
          <span
            className={
              rule.enabled
                ? "inline-flex items-center rounded-md bg-severity-low/15 px-1.5 py-0.5 text-[0.68rem] font-medium text-severity-low ring-1 ring-severity-low/30 ring-inset"
                : "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground ring-1 ring-border ring-inset"
            }
          >
            {rule.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-foreground">{rule.name}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{rule.description}</p>
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Rule details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Rule ID">
            <span className="font-mono text-xs break-all">{rule.id}</span>
          </Fact>
          <Fact label="Rule type">
            <span className="font-mono text-xs">{rule.ruleType}</span>
          </Fact>
          <Fact label="Severity">
            <SeverityBadge severity={rule.severity} />
          </Fact>
          <Fact label="Threshold">{rule.threshold ?? "—"}</Fact>
          <Fact label="Time window">
            {rule.timeWindowSeconds ? `${rule.timeWindowSeconds}s` : "—"}
          </Fact>
          <Fact label="Alerts produced">{rule.alertCount}</Fact>
          <Fact label="Created by">
            {rule.createdBy ? `${rule.createdBy.name} (${rule.createdBy.email})` : "—"}
          </Fact>
          <Fact label="Created">
            <span className="font-mono text-xs">{formatDateTime(rule.createdAt)}</span>
          </Fact>
          <Fact label="Updated">
            <span className="font-mono text-xs">{formatDateTime(rule.updatedAt)}</span>
          </Fact>
        </dl>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Condition</h2>
        <pre className="max-h-96 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-xs text-muted-foreground">
          {conditionJson}
        </pre>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Recent alerts ({rule.recentAlerts.length})
        </h2>
        {rule.recentAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">This rule has not produced any alerts yet.</p>
        ) : (
          <ul className="space-y-2">
            {rule.recentAlerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-2"
              >
                <Link
                  href={`/alerts/${alert.id}`}
                  className="truncate text-sm text-primary hover:underline"
                >
                  {alert.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status} />
                  <span className="font-mono text-xs text-muted-foreground">
                    risk {alert.riskScore}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
