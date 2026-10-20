"use client";

import * as React from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";

/** The suite's interactive charts (owner request, 19 October 2026: "graphs, bentos, proper
 *  dashboarding"). Drawn to scale in SVG from zero, with a hover and keyboard layer: a crosshair that
 *  snaps to the nearest week on lines, the band itself on columns, and one readout listing every
 *  series. Every value is also in a visually hidden table, so the tooltip never gates a number. */

type Format = (n: number) => string;
const count: Format = n => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
/** How a chart writes its numbers. A name, not a function, so server pages can choose it. */
export type ChartKind = "count" | "percent";
const FORMATS: Record<ChartKind, Format> = { count, percent: n => `${Math.round(n)}%` };

/** A clean axis for counts: a step of 1, 2, 2.5 or 5 times a power of ten (never a fraction of a
 *  whole), about four steps up to a top that holds the largest value. */
export function niceScale(value: number) {
  const rough = Math.max(value, 1) / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map(m => m * exp).find(s => s >= rough && (s >= 10 || Number.isInteger(s))) ?? 10 * exp);
  const top = Math.max(step, Math.ceil(Math.max(value, 1) / step) * step);
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** The pointer's band on a chart `bands` wide, from a pointer event over the SVG. */
function bandAt(event: React.PointerEvent<SVGSVGElement>, bands: number, left: number, right: number, width: number, mode: "point" | "band") {
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * width;
  const inner = (x - left) / (width - left - right);
  const i = mode === "point" ? Math.round(inner * (bands - 1)) : Math.floor(inner * bands);
  return Math.max(0, Math.min(bands - 1, i));
}

/** The chart's drawn width in CSS pixels, so text and marks keep their size at any panel width. */
function useWidth(fallback = 640) {
  const ref = React.useRef<HTMLElement>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function useActive(length: number) {
  const [active, setActive] = React.useState<number | null>(null);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!length) return;
    const move = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setActive(current => Math.max(0, Math.min(length - 1, current === null ? (move > 0 ? 0 : length - 1) : current + move)));
  };
  return { active, setActive, onKeyDown };
}

function Readout({ x, title, rows, align }: { x: number; title: string; rows: { key: string; label: string; value: string; series?: string }[]; align: "start" | "middle" | "end" }) {
  return <div className="ins-tip" data-align={align} style={{ left: `${x}%` }} aria-hidden="true">
    <span className="ins-tip-title">{title}</span>
    {rows.map(r => <span key={r.key} className="ins-tip-row"><span className="ins-tip-key" data-series={r.series} /><strong>{r.value}</strong><span>{r.label}</span></span>)}
  </div>;
}

const tipAlign = (share: number) => share < 0.18 ? "start" : share > 0.82 ? "end" : "middle";

/** A line over time with a soft area beneath, crosshair readout, the last value marked. */
export function AreaChart({ points, label, unit, kind = "count", height = 220, compare }: {
  points: { x: string; tick: string; y: number; title: string }[]; label: string; unit?: string; kind?: ChartKind; height?: number;
  /** An optional quieter second line on the same scale (the school's figure beside a teacher's). */
  compare?: { label: string; values: (number | null)[] };
}) {
  const [ref, W] = useWidth();
  const H = height, L = 40, R = 12, T = 14, B = 26;
  const format = FORMATS[kind];
  const id = React.useId().replace(/:/g, "");
  const { active, setActive, onKeyDown } = useActive(points.length);
  const { top, ticks } = niceScale(Math.max(...points.map(p => p.y), ...(compare?.values.filter((v): v is number => v !== null) ?? [])));
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";
  const other = compare ? compare.values.map((v, i) => v === null ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).reduce<string[]>((path, p, i, all) => {
    if (p !== null) path.push(`${i && all[i - 1] !== null ? "L" : "M"}${p}`);
    return path;
  }, []).join(" ") : "";
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 96))));
  const last = points.at(-1);
  const shown = active !== null ? points[active] : null;
  if (!points.length) return <p className="ins-sub">Nothing to show for this period.</p>;
  return <figure ref={ref} className="ins-chart" onPointerLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-svg" role="img" aria-label={`${label}. From ${format(points[0].y)} to ${format(last!.y)}${unit ? ` ${unit}` : ""}. Use the arrow keys to read each point.`}
      tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
      onPointerMove={event => setActive(bandAt(event, points.length, L, R, W, "point"))}>
      <Gradients id={id} />
      {ticks.map(t => <g key={t}>
        <line className={t === 0 ? "ins-baseline" : "ins-gridline"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
        <text className="ins-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
      </g>)}
      {points.map((p, i) => (i % every === 0 && points.length - 1 - i >= every * 0.6) || i === points.length - 1 ? <text key={p.x} className="ins-axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{p.tick}</text> : null)}
      <path d={area} fill={`url(#fill-${id})`} />
      {other ? <path className="ins-line-compare" d={other} /> : null}
      <path className="ins-line" d={line} stroke={`url(#line-${id})`} />
      {shown && active !== null ? <>
        <line className="ins-cross" x1={x(active)} x2={x(active)} y1={T} y2={y(0)} />
        <circle className="ins-dot" cx={x(active)} cy={y(shown.y)} r={5} />
      </> : last ? <circle className="ins-dot" cx={x(points.length - 1)} cy={y(last.y)} r={4.5} /> : null}
    </svg>
    {shown && active !== null ? <Readout x={(x(active) / W) * 100} align={tipAlign(x(active) / W)} title={shown.title} rows={[
      { key: "a", label: unit ?? label, value: format(shown.y), series: "a" },
      ...(compare && compare.values[active] !== null ? [{ key: "b", label: compare.label, value: format(compare.values[active]!), series: "compare" }] : []),
    ]} /> : null}
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableBody>{points.map((p, i) => <TableRow key={p.x}><TableHead scope="row">{p.title}</TableHead><TableCell>{format(p.y)}</TableCell>{compare ? <TableCell>{compare.values[i] === null ? "" : `${compare.label} ${format(compare.values[i]!)}`}</TableCell> : null}</TableRow>)}</TableBody></Table>
  </figure>;
}

/** In and out each period: the first series rises above the line, the second drops below it,
 *  so growth and loss read at a glance. A net figure sits in the readout. */
export function FlowChart({ rows, a, b, label, height = 220 }: { rows: { key: string; tick: string; title: string; a: number; b: number }[]; a: string; b: string; label: string; height?: number }) {
  const [ref, W] = useWidth();
  const H = height, L = 32, R = 8, T = 10, B = 26;
  const id = React.useId().replace(/:/g, "");
  const { active, setActive, onKeyDown } = useActive(rows.length);
  const { top, ticks } = niceScale(Math.max(...rows.flatMap(r => [r.a, r.b])));
  const band = (W - L - R) / Math.max(1, rows.length);
  const bar = Math.min(18, band * 0.62);
  const mid = T + (H - T - B) / 2;
  const scale = (H - T - B) / 2 / top;
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 80))));
  const shown = active !== null ? rows[active] : null;
  return <figure ref={ref} className="ins-chart" onPointerLeave={() => setActive(null)}>
    <ul className="ins-legend" aria-hidden="true"><li><span className="ins-swatch" data-series="a" />{a}</li><li><span className="ins-swatch" data-series="b" />{b}</li></ul>
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-svg" role="img" aria-label={`${label}. Use the arrow keys to read each period.`}
      tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
      onPointerMove={event => setActive(bandAt(event, rows.length, L, R, W, "band"))}>
      <Gradients id={id} />
      {ticks.filter((_, i) => i === 0 || i === ticks.length - 1 || (ticks.length % 2 === 1 && i === (ticks.length - 1) / 2)).flatMap(t => t === 0 ? [{ t, dy: 0 }] : [{ t, dy: -t * scale }, { t, dy: t * scale }]).map(({ t, dy }) => <g key={dy}>
        <line className={t === 0 ? "ins-baseline" : "ins-gridline"} x1={L} x2={W - R} y1={mid + dy} y2={mid + dy} />
        <text className="ins-axis" x={L - 6} y={mid + dy + 4} textAnchor="end">{count(t)}</text>
      </g>)}
      {rows.map((r, i) => {
        const cx = L + band * i + band / 2;
        const up = r.a * scale, down = r.b * scale;
        return <g key={r.key} data-active={active === i ? "" : undefined} className="ins-band">
          {active === i ? <rect className="ins-band-hover" x={L + band * i} y={T} width={band} height={H - T - B} /> : null}
          {up ? <path className="ins-col-a" d={roundedUp(cx - bar / 2, mid - 1, bar, up)} fill={`url(#col-a-${id})`} /> : null}
          {down ? <path className="ins-col-b" d={roundedDown(cx - bar / 2, mid + 1, bar, down)} fill={`url(#col-b-${id})`} /> : null}
          {i % every === 0 ? <text className="ins-axis" x={cx} y={H - 6} textAnchor="middle">{r.tick}</text> : null}
        </g>;
      })}
    </svg>
    {shown && active !== null ? <Readout x={((L + band * active + band / 2) / W) * 100} align={tipAlign((L + band * active) / W)} title={shown.title} rows={[
      { key: "a", label: a, value: count(shown.a), series: "a" },
      { key: "b", label: b, value: count(shown.b), series: "b" },
      { key: "n", label: "Net", value: `${shown.a - shown.b > 0 ? "+" : shown.a - shown.b < 0 ? "−" : ""}${count(Math.abs(shown.a - shown.b))}` },
    ]} /> : null}
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableHeader><TableRow><TableHead scope="col">Period</TableHead><TableHead scope="col">{a}</TableHead><TableHead scope="col">{b}</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.title}</TableHead><TableCell>{r.a}</TableCell><TableCell>{r.b}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** One series as columns (ordered bands such as ages), value on each cap. */
export function ColumnChart({ rows, label, kind = "count", height = 200 }: {
  rows: { key: string; tick: string; value: number; short?: string }[]; label: string; kind?: ChartKind; height?: number;
}) {
  const [ref, W] = useWidth();
  const H = height, L = 8, R = 8, T = 22, B = 26;
  const format = FORMATS[kind];
  const id = React.useId().replace(/:/g, "");
  const { active, setActive, onKeyDown } = useActive(rows.length);
  const top = Math.max(1, ...rows.map(r => r.value));
  const band = (W - L - R) / Math.max(1, rows.length);
  const bar = Math.min(64, band * 0.56);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  return <figure ref={ref} className="ins-chart" onPointerLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-svg" role="img" aria-label={`${label}. Use the arrow keys to read each column.`}
      tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
      onPointerMove={event => setActive(bandAt(event, rows.length, L, R, W, "band"))}>
      <Gradients id={id} />
      <line className="ins-baseline" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      {rows.map((r, i) => {
        const cx = L + band * i + band / 2;
        const h = y(0) - y(r.value);
        return <g key={r.key} className="ins-band" data-active={active === i ? "" : undefined}>
          {h > 0 ? <path className="ins-col-a" d={roundedUp(cx - bar / 2, y(0), bar, h)} fill={`url(#col-a-${id})`} /> : null}
          <text className="ins-cap" x={cx} y={y(r.value) - 7} textAnchor="middle">{format(r.value)}</text>
          <text className="ins-axis" x={cx} y={H - 6} textAnchor="middle">{band < 72 && r.short ? r.short : r.tick}</text>
        </g>;
      })}
    </svg>
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.tick}</TableHead><TableCell>{format(r.value)}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** Week by week as columns, with the same week one period earlier as a quieter column beside each, and
 *  a readout of both on hover or with the arrow keys. */
export function CompareColumns({ rows, label, unit, previousLabel, tone, height = 220 }: {
  rows: { key: string; tick: string; title: string; value: number; previous: number | null }[];
  label: string; unit: string; previousLabel: string; tone?: "b"; height?: number;
}) {
  const [ref, W] = useWidth();
  const H = height, L = 36, R = 8, T = 12, B = 26;
  const id = React.useId().replace(/:/g, "");
  const { active, setActive, onKeyDown } = useActive(rows.length);
  const { top, ticks } = niceScale(Math.max(...rows.flatMap(r => [r.value, r.previous ?? 0])));
  const band = (W - L - R) / Math.max(1, rows.length);
  const bar = Math.min(16, band * 0.32);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 80))));
  const shown = active !== null ? rows[active] : null;
  return <figure ref={ref} className="ins-chart" onPointerLeave={() => setActive(null)}>
    <ul className="ins-legend" aria-hidden="true"><li><span className="ins-swatch" data-series={tone ?? "a"} />This period</li><li><span className="ins-swatch" data-series="previous" />{previousLabel}</li></ul>
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-svg" role="img" aria-label={`${label}. Use the arrow keys to read each week.`}
      tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
      onPointerMove={event => setActive(bandAt(event, rows.length, L, R, W, "band"))}>
      <Gradients id={id} />
      {ticks.map(t => <g key={t}>
        <line className={t === 0 ? "ins-baseline" : "ins-gridline"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
        <text className="ins-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{count(t)}</text>
      </g>)}
      {rows.map((r, i) => {
        const cx = L + band * i + band / 2;
        const h = y(0) - y(r.value), hp = r.previous === null ? 0 : y(0) - y(r.previous);
        return <g key={r.key} className="ins-band" data-active={active === i ? "" : undefined}>
          {active === i ? <rect className="ins-band-hover" x={L + band * i} y={T} width={band} height={H - T - B} /> : null}
          {hp > 0 ? <path className="ins-col-previous" d={roundedUp(cx - bar - 1, y(0), bar, hp)} /> : null}
          {h > 0 ? <path className={tone === "b" ? "ins-col-b" : "ins-col-a"} d={roundedUp(cx + 1, y(0), bar, h)} fill={`url(#${tone === "b" ? "col-b-up" : "col-a"}-${id})`} /> : null}
          {i % every === 0 ? <text className="ins-axis" x={cx} y={H - 6} textAnchor="middle">{r.tick}</text> : null}
        </g>;
      })}
    </svg>
    {shown && active !== null ? <Readout x={((L + band * active + band / 2) / W) * 100} align={tipAlign((L + band * active) / W)} title={shown.title} rows={[
      { key: "a", label: unit, value: count(shown.value), series: tone ?? "a" },
      ...(shown.previous !== null ? [{ key: "p", label: previousLabel, value: count(shown.previous), series: "compare" }] : []),
    ]} /> : null}
    <Table containerClassName="sr-only"><TableCaption>{label}</TableCaption><TableHeader><TableRow><TableHead scope="col">Week</TableHead><TableHead scope="col">{unit}</TableHead><TableHead scope="col">{previousLabel}</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.key}><TableHead scope="row">{r.title}</TableHead><TableCell>{count(r.value)}</TableCell><TableCell>{r.previous === null ? "" : count(r.previous)}</TableCell></TableRow>)}</TableBody></Table>
  </figure>;
}

/** The chart's gradients, coloured from the stylesheet: the area wash, the line running from blue
 *  into violet, and each series' columns deepening towards the data end. */
function Gradients({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" className="ins-fill-top" />
      <stop offset="100%" className="ins-fill-bottom" />
    </linearGradient>
    <linearGradient id={`line-${id}`} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" className="ins-stop-a" />
      <stop offset="100%" className="ins-stop-v" />
    </linearGradient>
    <linearGradient id={`col-a-${id}`} x1="0" x2="0" y1="1" y2="0">
      <stop offset="0%" className="ins-stop-a" />
      <stop offset="100%" className="ins-stop-v" />
    </linearGradient>
    <linearGradient id={`col-b-up-${id}`} x1="0" x2="0" y1="1" y2="0">
      <stop offset="0%" className="ins-stop-b" />
      <stop offset="100%" className="ins-stop-b2" />
    </linearGradient>
    <linearGradient id={`col-b-${id}`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" className="ins-stop-b" />
      <stop offset="100%" className="ins-stop-b2" />
    </linearGradient>
  </defs>;
}

/** A column rising from `base`: square at the baseline, 4px round at the data end. */
function roundedUp(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + w - r} Q${x + w} ${base - h} ${x + w} ${base - h + r} V${base} Z`;
}
function roundedDown(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${base} V${base + h - r} Q${x} ${base + h} ${x + r} ${base + h} H${x + w - r} Q${x + w} ${base + h} ${x + w} ${base + h - r} V${base} Z`;
}
