"use client";

import * as React from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";

/** The suite's interactive charts (owner request, 19 October 2026: "graphs, bentos, proper
 *  dashboarding"), on the shadcn Chart component (owner rule, 20 October 2026: only shadcn
 *  components). Drawn to scale from zero in the theme's chart colours, with a readout on hover or
 *  with the arrow keys once the chart has focus. Every value is also in a visually hidden table,
 *  so the readout never gates a number. */

type Format = (n: number) => string;
const count: Format = n => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
/** How a chart writes its numbers. A name, not a function, so server pages can choose it. */
export type ChartKind = "count" | "percent";
const FORMATS: Record<ChartKind, Format> = { count, percent: n => `${Math.round(n)}%` };

/** The theme's colours for each series (glass.css): the fin's blue for the figure, the warning
 *  amber for the second series, and quiet greys for the comparison and the period before. */
const SERIES = {
  a: "var(--accent)",
  b: "var(--orange-ink)",
  compare: "var(--label-2)",
  previous: "var(--sep)",
} as const;
type Series = keyof typeof SERIES;
const SWATCH: Record<Series, string> = { a: "bg-(--color-a)", b: "bg-(--color-b)", compare: "bg-(--color-compare)", previous: "bg-(--color-previous)" };

/** Chart heights the pages use, as Tailwind sizes. */
const HEIGHTS: Record<number, string> = { 150: "h-38", 190: "h-48", 200: "h-50", 220: "h-56", 240: "h-60" };
const heightClass = (height: number) => HEIGHTS[height] ?? "h-56";

/** A clean axis for counts: a step of 1, 2, 2.5 or 5 times a power of ten (never a fraction of a
 *  whole), about four steps up to a top that holds the largest value. */
function niceScale(value: number) {
  const rough = Math.max(value, 1) / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map(m => m * exp).find(s => s >= rough && (s >= 10 || Number.isInteger(s))) ?? 10 * exp);
  const top = Math.max(step, Math.ceil(Math.max(value, 1) / step) * step);
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** One readout row: the series' swatch, the value and what it is. */
function ReadoutRow({ series, value, label }: { series?: Series; value: string; label: React.ReactNode }) {
  return <span className="flex w-full items-center gap-2">
    {series ? <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${SWATCH[series]}`} /> : <span aria-hidden="true" className="size-2.5 shrink-0" />}
    <strong className="font-semibold tabular-nums">{value}</strong>
    <span className="text-ui-muted-foreground">{label}</span>
  </span>;
}

const axis = { tickLine: false, axisLine: false, tickMargin: 8 } as const;
const config = (labels: Partial<Record<Series, string>>) => Object.fromEntries(
  Object.entries(labels).map(([key, label]) => [key, { label, color: SERIES[key as Series] }]),
) satisfies ChartConfig;

/** A line over time with a soft area beneath, a readout per week, the last value marked. */
export function AreaChart({ points, label, unit, kind = "count", height = 220, compare }: {
  points: { x: string; tick: string; y: number; title: string }[]; label: string; unit?: string; kind?: ChartKind; height?: number;
  /** An optional quieter second line on the same scale (the school's figure beside a teacher's). */
  compare?: { label: string; values: (number | null)[] };
}) {
  const format = FORMATS[kind];
  const id = React.useId().replace(/:/g, "");
  if (!points.length) return <p className="ins-sub">Nothing to show for this period.</p>;
  const { top, ticks } = niceScale(Math.max(...points.map(p => p.y), ...(compare?.values.filter((v): v is number => v !== null) ?? [])));
  const data = points.map((p, i) => ({ ...p, a: p.y, compare: compare?.values[i] ?? null }));
  const last = points.length - 1;
  return <figure className="ins-chart">
    <ChartContainer config={config({ a: unit ?? label, ...(compare ? { compare: compare.label } : {}) })} className={`aspect-auto w-full ${heightClass(height)}`}
      aria-label={`${label}. From ${format(points[0].y)} to ${format(points[last].y)}${unit ? ` ${unit}` : ""}. Use the arrow keys to read each point.`}>
      <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-a)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-a)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="tick" {...axis} minTickGap={24} interval="preserveStartEnd" />
        <YAxis {...axis} width={40} domain={[0, top]} ticks={ticks} tickFormatter={format} />
        <ChartTooltip content={<ChartTooltipContent labelKey="title" labelFormatter={(_, payload) => payload?.[0]?.payload?.title}
          formatter={(value, name) => <ReadoutRow series={name as Series} value={format(Number(value))} label={name === "compare" ? compare?.label : unit ?? label} />} />} />
        <Area dataKey="a" type="linear" stroke="var(--color-a)" strokeWidth={2.5} fill={`url(#fill-${id})`} isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; index?: number }) => props.index === last ? <circle key="last" cx={props.cx} cy={props.cy} r={4.5} className="fill-(--color-a) stroke-ui-background" strokeWidth={2} /> : <g key={props.index} />}
          activeDot={{ r: 5, className: "fill-(--color-a) stroke-ui-background", strokeWidth: 2 }} />
        {compare ? <Line dataKey="compare" type="linear" stroke="var(--color-compare)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} /> : null}
      </ComposedChart>
    </ChartContainer>
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableBody>{points.map((p, i) => <TableRow key={p.x}><TableHead scope="row">{p.title}</TableHead><TableCell>{format(p.y)}</TableCell>{compare ? <TableCell>{compare.values[i] === null ? "" : `${compare.label} ${format(compare.values[i]!)}`}</TableCell> : null}</TableRow>)}</TableBody></Table>
  </figure>;
}

/** In and out each period: the first series rises above the line, the second drops below it,
 *  so growth and loss read at a glance. A net figure sits in the readout. */
export function FlowChart({ rows, a, b, label, height = 220 }: { rows: { key: string; tick: string; title: string; a: number; b: number }[]; a: string; b: string; label: string; height?: number }) {
  const { top } = niceScale(Math.max(...rows.flatMap(r => [r.a, r.b])));
  const data = rows.map(r => ({ ...r, a: r.a, b: -r.b }));
  const net = (row: { a: number; b: number }) => { const n = row.a + row.b; return `${n > 0 ? "+" : n < 0 ? "−" : ""}${count(Math.abs(n))}`; };
  return <figure className="ins-chart">
    <ChartContainer config={config({ a, b })} className={`aspect-auto w-full ${heightClass(height)}`} aria-label={`${label}. Use the arrow keys to read each period.`}>
      <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="tick" {...axis} minTickGap={16} />
        <YAxis {...axis} width={32} domain={[-top, top]} ticks={[-top, 0, top]} tickFormatter={n => count(Math.abs(n))} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.title}
          formatter={(value, name, item, index) => <>
            <ReadoutRow series={name as Series} value={count(Math.abs(Number(value)))} label={name === "a" ? a : b} />
            {index === 1 ? <ReadoutRow value={net(item.payload as { a: number; b: number })} label="Net" /> : null}
          </>} />} />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
        <Bar dataKey="a" stackId="flow" fill="var(--color-a)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="b" stackId="flow" fill="var(--color-b)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableHeader><TableRow><TableHead scope="col">Period</TableHead><TableHead scope="col">{a}</TableHead><TableHead scope="col">{b}</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.title}</TableHead><TableCell>{r.a}</TableCell><TableCell>{r.b}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** One series as columns (ordered bands such as ages), value on each cap. */
export function ColumnChart({ rows, label, kind = "count", height = 200 }: {
  rows: { key: string; tick: string; value: number; short?: string }[]; label: string; kind?: ChartKind; height?: number;
}) {
  const format = FORMATS[kind];
  return <figure className="ins-chart">
    <ChartContainer config={config({ a: label })} className={`aspect-auto w-full ${heightClass(height)}`} aria-label={`${label}. Use the arrow keys to read each column.`}>
      <BarChart data={rows} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="tick" {...axis} interval={0} tickFormatter={(tick: string, i) => rows.length > 6 && rows[i]?.short ? rows[i].short! : tick} />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => <ReadoutRow series="a" value={format(Number(value))} label={(item.payload as { tick: string }).tick} />} />} />
        {/* A zero still gets its column (a clear one) so its cap reads "0". */}
        <Bar dataKey="value" fill="var(--color-a)" radius={[4, 4, 0, 0]} maxBarSize={64} minPointSize={1} isAnimationActive={false}>
          {rows.map(r => <Cell key={r.key} fill={r.value ? "var(--color-a)" : "transparent"} />)}
          <LabelList dataKey="value" position="top" className="fill-ui-foreground font-bold" formatter={(value: unknown) => format(Number(value))} />
        </Bar>
      </BarChart>
    </ChartContainer>
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.tick}</TableHead><TableCell>{format(r.value)}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** Week by week as columns, with the same week one period earlier as a quieter column beside each, and
 *  a readout of both on hover or with the arrow keys. */
export function CompareColumns({ rows, label, unit, previousLabel, tone, height = 220 }: {
  rows: { key: string; tick: string; title: string; value: number; previous: number | null }[];
  label: string; unit: string; previousLabel: string; tone?: "b"; height?: number;
}) {
  const { top, ticks } = niceScale(Math.max(...rows.flatMap(r => [r.value, r.previous ?? 0])));
  const now: Series = tone ?? "a";
  const data = rows.map(r => ({ ...r, [now]: r.value }));
  return <figure className="ins-chart">
    <ChartContainer config={config({ previous: previousLabel, [now]: "This period" })} className={`aspect-auto w-full ${heightClass(height)}`} aria-label={`${label}. Use the arrow keys to read each week.`}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="tick" {...axis} minTickGap={16} />
        <YAxis {...axis} width={36} domain={[0, top]} ticks={ticks} tickFormatter={count} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.title}
          formatter={(value, name) => <ReadoutRow series={name === "previous" ? "compare" : now} value={count(Number(value))} label={name === "previous" ? previousLabel : unit} />} />} />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
        <Bar dataKey="previous" fill="var(--color-previous)" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        <Bar dataKey={now} fill={`var(--color-${now})`} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableHeader><TableRow><TableHead scope="col">Week</TableHead><TableHead scope="col">{unit}</TableHead><TableHead scope="col">{previousLabel}</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.title}</TableHead><TableCell>{count(r.value)}</TableCell><TableCell>{r.previous === null ? "" : count(r.previous)}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** A tiny line of the figure's recent history, the latest point marked. Decoration beside the
 *  number (the full series is on the page it opens), so hidden from screen readers. */
export function Sparkline({ values, tone }: { values: (number | null)[]; tone?: "good" | "bad" }) {
  const data = values.map((v, i) => ({ i, v }));
  const scored = data.filter(p => p.v !== null);
  if (scored.length < 2) return null;
  const last = scored.at(-1)!.i;
  const colour = tone === "good" ? "var(--green-ink)" : tone === "bad" ? "var(--red-ink)" : SERIES.a;
  return <div aria-hidden="true" className="ins-spark">
    <ChartContainer config={{ v: { color: colour } }} className="aspect-auto h-7 w-full">
      <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }} accessibilityLayer={false}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line dataKey="v" type="linear" stroke="var(--color-v)" strokeWidth={1.5} isAnimationActive={false} connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => props.index === last ? <circle key="last" cx={props.cx} cy={props.cy} r={2.5} className="fill-(--color-v)" /> : <g key={props.index} />} />
      </LineChart>
    </ChartContainer>
  </div>;
}
