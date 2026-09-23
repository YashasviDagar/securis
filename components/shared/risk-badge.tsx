import { riskBandFromScore, type RiskBand } from "@/types/security";
import { cn } from "@/lib/utils";

/**
 * Securis - Risk score badge
 *
 * Renders a deterministic 0-100 risk score together with its qualitative band.
 * The band (and therefore the colour) is derived from the score, so the same
 * score always looks the same everywhere.
 *
 * Connection: server/detection/risk.ts produces the score; alert and event
 * views render it here.
 */

const BAND_STYLES: Record<RiskBand, string> = {
  LOW: "bg-severity-low/15 text-severity-low ring-severity-low/30",
  MODERATE: "bg-severity-medium/15 text-severity-medium ring-severity-medium/30",
  HIGH: "bg-severity-high/15 text-severity-high ring-severity-high/30",
  CRITICAL: "bg-severity-critical/15 text-severity-critical ring-severity-critical/30",
};

const BAND_LABELS: Record<RiskBand, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function RiskScoreBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const band = riskBandFromScore(score);
  return (
    <span
      title={`Risk score ${score}/100 (${BAND_LABELS[band]})`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium tracking-wide ring-1 ring-inset",
        BAND_STYLES[band],
        className,
      )}
    >
      <span className="font-mono">{score}</span>
      <span className="opacity-70">/100</span>
      <span className="uppercase">{BAND_LABELS[band]}</span>
    </span>
  );
}

/** A horizontal meter visualising the score against the 0-100 range. */
export function RiskMeter({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const band = riskBandFromScore(score);
  const fill: Record<RiskBand, string> = {
    LOW: "bg-severity-low",
    MODERATE: "bg-severity-medium",
    HIGH: "bg-severity-high",
    CRITICAL: "bg-severity-critical",
  };
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label="Risk score"
    >
      <div
        className={cn("h-full rounded-full", fill[band])}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}
