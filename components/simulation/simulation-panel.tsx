"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  KeyRound,
  Loader2,
  Play,
  ShieldAlert,
  ShieldOff,
  TrendingUp,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { cn } from "@/lib/utils";
import type { ScenarioDefinition, SimulationResult, SimulationScenario } from "@/types/simulation";

/**
 * Securis - Simulation panel
 *
 * Client component rendering one card per scenario. Running a scenario posts to
 * the simulation API, which feeds generated events through the real ingestion
 * and detection pipeline. The card shows the outcome (accepted events, alerts
 * created/updated) and links to any alerts raised.
 *
 * Connection: POST /api/simulation.
 */

const ICONS: Record<SimulationScenario, typeof Play> = {
  BRUTE_FORCE: KeyRound,
  ACCOUNT_TAKEOVER: ShieldAlert,
  PRIVILEGE_ESCALATION: UserCog,
  API_ABUSE: TrendingUp,
  UNAUTHORIZED_ACCESS: ShieldOff,
  NORMAL_TRAFFIC: Activity,
};

export function SimulationPanel({ scenarios }: { scenarios: ScenarioDefinition[] }) {
  const router = useRouter();
  const [running, setRunning] = useState<SimulationScenario | null>(null);
  const [results, setResults] = useState<Partial<Record<SimulationScenario, SimulationResult>>>({});

  async function run(scenario: SimulationScenario) {
    setRunning(scenario);
    try {
      const response = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; data?: SimulationResult }
        | null;

      if (!response.ok || !data?.ok || !data.data) {
        toast.error(data?.error ?? "Simulation failed.");
        return;
      }

      setResults((previous) => ({ ...previous, [scenario]: data.data! }));
      const created = data.data.alertsCreated;
      toast.success(
        created > 0
          ? `${data.data.scenarioName}: ${created} new alert${created > 1 ? "s" : ""} created.`
          : `${data.data.scenarioName}: ${data.data.accepted} events ingested.`,
      );
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((scenario) => {
        const Icon = ICONS[scenario.id];
        const result = results[scenario.id];
        const isRunning = running === scenario.id;

        return (
          <section
            key={scenario.id}
            className="flex flex-col rounded-xl border border-border/60 bg-card/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-medium text-foreground">{scenario.name}</h2>
                  <p className="text-[0.68rem] text-muted-foreground">
                    ~{scenario.eventCount} events
                  </p>
                </div>
              </div>
              <SeverityBadge severity={scenario.severity} />
            </div>

            <p className="mt-3 flex-1 text-sm text-muted-foreground">{scenario.description}</p>

            <p className="mt-2 text-[0.68rem] text-muted-foreground">
              Expected rule:{" "}
              <span className="font-mono text-foreground">
                {scenario.expectedRule ?? "none (baseline traffic)"}
              </span>
            </p>

            <Button
              size="sm"
              className="mt-3"
              disabled={isRunning}
              onClick={() => void run(scenario.id)}
            >
              {isRunning ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-3.5" aria-hidden="true" />
              )}
              {isRunning ? "Running…" : "Run scenario"}
            </Button>

            {result ? (
              <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-background/40 p-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-mono text-sm text-foreground">{result.accepted}</p>
                    <p className="text-[0.62rem] text-muted-foreground uppercase">events</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-severity-high">{result.alertsCreated}</p>
                    <p className="text-[0.62rem] text-muted-foreground uppercase">new alerts</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-muted-foreground">{result.findings}</p>
                    <p className="text-[0.62rem] text-muted-foreground uppercase">findings</p>
                  </div>
                </div>

                {result.alerts.length > 0 ? (
                  <ul className="space-y-1">
                    {result.alerts.map((alert) => (
                      <li key={alert.id}>
                        <Link
                          href={`/alerts/${alert.id}`}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs",
                            "text-primary hover:bg-muted/50 hover:underline",
                          )}
                        >
                          <span className="truncate">{alert.title}</span>
                          <span className="font-mono text-[0.68rem] text-muted-foreground">
                            risk {alert.riskScore}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.68rem] text-muted-foreground">
                    No alerts — as expected for baseline traffic.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
