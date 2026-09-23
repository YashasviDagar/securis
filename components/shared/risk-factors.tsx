import { cn } from "@/lib/utils";

/**
 * Securis - Risk factor breakdown
 *
 * Renders the itemised contributions that produced a risk score. This is the
 * "explain the score" surface: each factor shows its weight and a proportional
 * bar, so an analyst can see exactly why an alert scored what it did.
 *
 * The component tolerates the untyped JSON stored in `Alert.riskFactors` and
 * simply ignores entries that are not `{ factor, weight }`.
 *
 * Connection: server/detection/risk.ts (producer) -> alert/event views.
 */

export interface RiskFactor {
  factor: string;
  weight: number;
}

/** Narrow an unknown JSON value to a list of risk factors. */
export function parseRiskFactors(value: unknown): RiskFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      entry &&
      typeof entry === "object" &&
      "factor" in entry &&
      "weight" in entry &&
      typeof (entry as RiskFactor).factor === "string" &&
      typeof (entry as RiskFactor).weight === "number"
    ) {
      return [{ factor: (entry as RiskFactor).factor, weight: (entry as RiskFactor).weight }];
    }
    return [];
  });
}

export function RiskFactorList({
  factors,
  className,
}: {
  factors: unknown;
  className?: string;
}) {
  const parsed = parseRiskFactors(factors);
  if (parsed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No factor breakdown recorded for this score.
      </p>
    );
  }

  const maxWeight = Math.max(...parsed.map((factor) => factor.weight), 1);

  return (
    <ul className={cn("space-y-1.5", className)}>
      {parsed.map((factor, index) => (
        <li key={`${factor.factor}-${index}`} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-foreground">{factor.factor}</span>
            <span className="font-mono text-[0.7rem] text-muted-foreground">
              +{factor.weight}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${(factor.weight / maxWeight) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
