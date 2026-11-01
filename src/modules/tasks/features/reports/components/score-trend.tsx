"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";

type Point = { label: string; value: number | null };

const config = { value: { label: "Score", color: "var(--accent)" } } satisfies ChartConfig;

/** A site's score over the report's periods (the prototype's "Consistency over time"), on the
 *  shadcn Chart: one line in the chart blue with markers, a recessive 0/50/100% grid, and a
 *  hover or focus readout of the period and its score. Periods without a score break the line.
 *  The scores table beside it is the table view. */
export function ScoreTrend({ points, site }: { points: Point[]; site: string }) {
  const scored = points.filter((p) => p.value !== null);
  if (!scored.length) return <p className="text-sm text-ui-muted-foreground">No scores in this range yet.</p>;
  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer config={config} className="aspect-auto h-48 w-full"
        aria-label={`${site}'s score over time: ${scored.map((p) => `${p.label} ${p.value}%`).join(", ")}`}>
        <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip cursor={{ strokeDasharray: "4 4" }}
            content={<ChartTooltipContent formatter={(value) => <span className="tabular-nums"><strong className="font-semibold">{`${value}%`}</strong> score</span>} />} />
          <Line dataKey="value" type="linear" stroke="var(--color-value)" strokeWidth={2} connectNulls={false}
            dot={{ r: 4, fill: "var(--color-value)", stroke: "var(--bg-2)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--color-value)", stroke: "var(--bg-2)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}
