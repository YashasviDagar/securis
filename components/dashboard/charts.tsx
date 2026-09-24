"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AuthOutcomePoint,
  CategoryPoint,
  TimeSeriesPoint,
} from "@/types/dashboard";

/**
 * Securis - Dashboard charts
 *
 * Client components (Recharts needs the DOM). Every chart receives data that was
 * aggregated from the database by the dashboard service — none of these
 * components invent numbers.
 *
 * Colours come from the theme tokens declared in app/globals.css so the charts
 * stay consistent with the rest of the console.
 */

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
} as const;

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

/** Shorten an ISO date for the X axis. */
function shortDate(value: string): string {
  return value.slice(5); // MM-DD
}

/** A filled area chart for a daily time series. */
export function TimeSeriesChart({
  data,
  color = "var(--chart-1)",
  height = 220,
}: {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
}) {
  // A DOM-safe unique id for the gradient (CSS colour values contain characters
  // that are not valid inside an SVG id).
  const gradientId = `ts-fill-${useId().replace(/[:]/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={34} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** A vertical bar chart for categorical counts. */
export function CategoryBarChart({
  data,
  color = "var(--chart-1)",
  height = 220,
  colorByLabel,
}: {
  data: CategoryPoint[];
  color?: string;
  height?: number;
  /** Optional per-label colour (e.g. severity colours). */
  colorByLabel?: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={34} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={colorByLabel?.[entry.label] ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A horizontal bar chart, useful for long labels (IPs, usernames). */
export function HorizontalBarChart({
  data,
  color = "var(--chart-2)",
  height = 240,
}: {
  data: CategoryPoint[];
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A donut chart for authentication outcomes. */
export function AuthOutcomeChart({ data }: { data: AuthOutcomePoint[] }) {
  const colors: Record<string, string> = {
    SUCCESS: "var(--severity-low)",
    FAILURE: "var(--severity-high)",
  };
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="outcome"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.outcome} fill={colors[entry.outcome]} />
          ))}
        </Pie>
        <Legend
          formatter={(value) => <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
}
