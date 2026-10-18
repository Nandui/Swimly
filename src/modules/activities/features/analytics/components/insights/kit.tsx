import Link from "next/link";
import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { addDaysIso, formatCount, formatDateRange, formatDateTime, formatDayMonth } from "@/lib/format";
import { AnalyticsNav, type AnalyticsPage } from "@/modules/activities/features/analytics/components/navigation";
import { AnalyticsRefresh } from "@/modules/activities/features/analytics/components/refresh";
import { FilterBar, type FilterBarProps } from "@/modules/activities/features/analytics/components/insights/filters";
export { Meter } from "@/modules/activities/features/analytics/components/insights/meter";
import { DEFAULT_RANGE, RANGES, reportQuery, type ReportFilters, type ReportPeriod } from "@/modules/activities/features/analytics/server/period";

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function percent(value: number | null | undefined, digits: 0 | 1 = 0) {
  return value === null || value === undefined ? "—" : `${(digits ? one : whole).format(value)}%`;
}
export function decimal(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : one.format(value);
}
export function weeks(value: number) {
  return value < 1 ? "Under a week" : `${whole.format(value)} ${Math.round(value) === 1 ? "week" : "weeks"}`;
}

/** The shared context every report page receives. */
export type ReportContext = {
  period: ReportPeriod; filters: ReportFilters; programmes: { id: string; name: string }[]; programme: { id: string; name: string } | null;
  allSites: boolean; multipleSites: boolean; siteName: string; updatedAt: string;
  canOpenClasses: boolean; canOpenSwimmers: boolean;
};

/** The query string that keeps the chosen period, sites and programme. */
export function filterQuery(ctx: ReportContext, extra: Record<string, string> = {}) {
  return reportQuery(ctx.filters, extra);
}
/** A link to another analytics page that keeps the chosen period, sites and programme. */
export function reportHref(ctx: ReportContext, path: string, extra: Record<string, string> = {}) {
  return `${path}${filterQuery(ctx, extra)}`;
}

function periodText(period: ReportPeriod) {
  return period.key === "custom" ? formatDateRange(period.start, period.end) : `Last ${period.label}, ${formatDateRange(period.start, period.end)}`;
}
/** "now", or the last day of a custom period that ended before today. */
export function asOf(period: ReportPeriod, now = "now") {
  return period.current ? now : `on ${formatDayMonth(period.end)}`;
}

function quickPicks(ctx: ReportContext) {
  const date = ctx.period.now;
  const [y, m] = date.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${y}-${pad(m)}-01`;
  const lastMonthStart = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
  const schoolYear = m >= 9 ? y : y - 1;
  return [
    { label: "Last 30 days", start: addDaysIso(date, -29), end: date },
    { label: "This month", start: monthStart, end: date },
    { label: "Last month", start: lastMonthStart, end: addDaysIso(monthStart, -1) },
    { label: "This school year", start: `${schoolYear}-09-01`, end: date },
    { label: "Last school year", start: `${schoolYear - 1}-09-01`, end: `${schoolYear}-08-31` },
    { label: "This year", start: `${y}-01-01`, end: date },
    { label: "Last year", start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
  ];
}

/** Page opening, the suite's grouped pages, then one tray of filters. `programme` is false on pages
 *  the programme does not narrow (reception work is not tied to a programme). */
export function ReportShell({ ctx, page, path, title, description, back, children, footnotes, sections, programme = true }: {
  ctx: ReportContext; page: AnalyticsPage; path: string; title: string; description?: string;
  back?: { href: string; label: string }; children: React.ReactNode; footnotes?: React.ReactNode[];
  sections?: { id: string; label: string }[]; programme?: boolean;
}) {
  const { period, filters } = ctx;
  const keep = (extra: Partial<ReportFilters>) => `${path}${reportQuery({ ...filters, ...extra })}`;
  const keepParams = Object.fromEntries(new URLSearchParams(reportQuery({ ...filters, period: { key: DEFAULT_RANGE, start: "", end: "" } }).slice(1)));
  const defaults = !ctx.programme && !ctx.allSites && period.key === DEFAULT_RANGE;
  const bar: FilterBarProps = {
    path,
    presets: RANGES.map(range => ({ label: range.label, href: keep({ period: { key: range.key, start: "", end: "" } }), current: period.key === range.key })),
    custom: {
      current: period.key === "custom", start: period.start, end: period.end, today: period.now, label: formatDateRange(period.start, period.end), keep: keepParams,
      quick: quickPicks(ctx).map(q => ({ label: q.label, href: keep({ period: { key: "custom", start: q.start, end: q.end } }), current: period.key === "custom" && period.start === q.start && period.end === q.end })),
    },
    sites: ctx.multipleSites ? [
      { label: "This site", href: keep({ scope: "site" }), current: !ctx.allSites },
      { label: "All my sites", href: keep({ scope: "all" }), current: ctx.allSites },
    ] : null,
    programme: programme && ctx.programmes.length > 1 ? {
      value: ctx.programme?.id ?? "",
      options: [{ value: "", label: "Every programme", href: keep({ programme: null }) }, ...ctx.programmes.map(p => ({ value: p.id, label: p.name, href: keep({ programme: p.id }) }))],
    } : null,
    summary: {
      range: `${formatDateRange(period.start, period.end)} · ${period.label}`,
      compare: `Against ${formatDateRange(period.previousStart, period.previousEnd)}`,
      asOf: period.current ? null : `"Now" figures as of ${formatDayMonth(period.end)}`,
    },
    reset: defaults ? null : path,
  };
  const scope = [ctx.siteName, ctx.programme && programme ? ctx.programme.name : null].filter(Boolean).join(" · ");
  return <div className="ins">
    <div className="ins-hero">
      <span className="ins-eyebrow">Swim school analytics</span>
      <PageHeader title={title} back={back} description={description ?? `${scope} · ${periodText(period)}`} actions={<AnalyticsRefresh />} />
    </div>
    <AnalyticsNav active={page} query={filterQuery(ctx)} />
    <FilterBar {...bar} />
    {sections?.length ? <nav aria-label="On this page" className="ins-jump">
      <span className="ins-jump-label">On this page</span>
      {sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
    </nav> : null}
    {children}
    <footer className="ins-footnote">
      {footnotes?.map((note, i) => <p key={i}>{note}</p>)}
      {programme && ctx.programme ? <p>Only {ctx.programme.name}: its classes, places, waiting lists and passes. A move into another programme counts as leaving this one.</p> : null}
      <p>Compared with the {period.label} before, {formatDateRange(period.previousStart, period.previousEnd)}. Updated {formatDateTime(new Date(ctx.updatedAt))} · Europe/Dublin.</p>
    </footer>
  </div>;
}

/** A group of panels that answer one question, with a short heading and what it is for. */
export function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return <section id={id} className="ins-section" aria-labelledby={`${id}-title`}>
    <header className="ins-section-head">
      <span className="ins-section-eyebrow">{eyebrow}</span>
      <h2 id={`${id}-title`}>{title}</h2>
      {intro ? <p>{intro}</p> : null}
    </header>
    {children}
  </section>;
}

export function Panel({ id, title, sub, action, children, className }: { id: string; title: string; sub?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`pc-panel${className ? ` ${className}` : ""}`} aria-labelledby={`${id}-heading`}>
    <div className="ins-head"><h3 id={`${id}-heading`}>{title}</h3>{action}</div>
    {sub ? <p className="ins-sub">{sub}</p> : null}
    {children}
  </section>;
}

/** The headline figures, laid out in even rows whatever their number. */
export function KpiStrip({ label, children }: { label: string; children: React.ReactNode }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  return <ul className="ins-kpis" aria-label={label} data-count={count}>{children}</ul>;
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{children}<ArrowRight aria-hidden="true" className="size-4" /></Link>;
}

type Change = { current: number | null; previous: number | null; change: number | null };

/** A change against the previous period, as words and an arrow, green when it
 *  went the good way. `unit` "pts" for percentages. */
export function Delta({ change, better, unit = "", label }: { change: Change; better: "up" | "down" | "none"; unit?: "" | "pts"; label: string }) {
  if (change.change === null) return <span className="ins-delta">No earlier figure</span>;
  const value = change.change;
  const rounded = unit === "pts" ? Math.round(value * 10) / 10 : Math.round(value);
  const tone = rounded === 0 || better === "none" ? undefined : (rounded > 0) === (better === "up") ? "good" : "bad";
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : ArrowRight;
  const text = rounded === 0 ? "No change" : `${rounded > 0 ? "+" : "−"}${unit === "pts" ? one.format(Math.abs(rounded)) : formatCount(Math.abs(rounded))}${unit === "pts" ? " pts" : ""}`;
  return <span className="ins-delta" data-tone={tone}><Icon aria-hidden="true" />{text}<span className="sr-only"> {label}</span></span>;
}

export function Kpi({ label, value, unit, note, delta, href }: { label: string; value: React.ReactNode; unit?: string; note?: React.ReactNode; delta?: React.ReactNode; href?: string }) {
  const body = <>
    <span className="ins-kpi-label">{label}</span>
    <span className="ins-kpi-value">{value}{unit ? <small>{unit}</small> : null}</span>
    {delta}
    {note ? <span className="ins-kpi-note">{note}</span> : null}
  </>;
  return <li className="flex min-w-0">{href ? <Link href={href} className="ins-kpi w-full">{body}<span className="ins-kpi-go" aria-hidden="true"><ArrowUpRight strokeWidth={1.8} /></span></Link> : <div className="ins-kpi w-full">{body}</div>}</li>;
}

/** A line over time with its area, to scale from zero, every point hoverable. */
export function TrendChart({ points, label, format = formatCount }: { points: { x: string; y: number; label: string }[]; label: string; format?: (n: number) => string }) {
  const W = 640, H = 200, L = 44, R = 16, T = 12, B = 28;
  const max = niceMax(Math.max(1, ...points.map(p => p.y)));
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const ticks = [0, max / 2, max];
  const step = (W - L - R) / Math.max(1, points.length - 1);
  const labelEvery = Math.ceil(points.length / 6);
  const last = points.at(-1);
  return <figure className="m-0 flex flex-col gap-2">
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-trend" role="img" aria-label={`${label}. ${points.length ? `From ${format(points[0].y)} to ${format(last!.y)}.` : ""}`}>
      {ticks.map(t => <g key={t}><line className="ins-gridline" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text className="ins-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}
      {points.length ? <><path className="ins-area" d={area} /><path className="ins-line" d={line} /></> : null}
      {points.map((p, i) => i % labelEvery === 0 || i === points.length - 1 ? <text key={p.x} className="ins-axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{formatDayMonth(p.x)}</text> : null)}
      {last ? <circle className="ins-end" cx={x(points.length - 1)} cy={y(last.y)} r={5} /> : null}
      {points.map((p, i) => <rect key={`hit-${p.x}`} className="ins-hit" x={x(i) - step / 2} y={T} width={step} height={H - T - B}><title>{`${p.label}: ${format(p.y)}`}</title></rect>)}
    </svg>
  </figure>;
}

/** Two series side by side per period (joined and left), to one scale. */
export function PairedColumns({ rows, a, b, label }: { rows: { key: string; label: string; a: number; b: number }[]; a: string; b: string; label: string }) {
  const W = 640, H = 200, L = 32, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(1, ...rows.flatMap(r => [r.a, r.b])));
  const band = (W - L - R) / Math.max(1, rows.length);
  const bar = Math.min(16, band / 3);
  const labelEvery = Math.ceil(rows.length / 8);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return <figure className="m-0 flex flex-col gap-3">
    <ul className="ins-legend" aria-hidden="true"><li><span className="ins-swatch" />{a}</li><li><span className="ins-swatch" data-series="b" />{b}</li></ul>
    <svg viewBox={`0 0 ${W} ${H}`} className="ins-trend" role="img" aria-label={label}>
      {[0, max / 2, max].map(t => <g key={t}><line className="ins-gridline" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text className="ins-axis" x={L - 6} y={y(t) + 4} textAnchor="end">{formatCount(t)}</text></g>)}
      {rows.map((r, i) => {
        const cx = L + band * i + band / 2;
        return <g key={r.key}>
          <rect className="ins-col-a" x={cx - bar - 1} y={y(r.a)} width={bar} height={Math.max(0, y(0) - y(r.a))} rx={3}><title>{`${r.label}: ${r.a} ${a.toLowerCase()}`}</title></rect>
          <rect className="ins-col-b" x={cx + 1} y={y(r.b)} width={bar} height={Math.max(0, y(0) - y(r.b))} rx={3}><title>{`${r.label}: ${r.b} ${b.toLowerCase()}`}</title></rect>
          {i % labelEvery === 0 ? <text className="ins-axis" x={cx} y={H - 8} textAnchor="middle">{r.label}</text> : null}
        </g>;
      })}
    </svg>
  </figure>;
}

function niceMax(value: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 2.5, 5, 10]) if (value <= m * exp) return m * exp;
  return 10 * exp;
}

/** Horizontal bars to one scale, with the number at the end. */
export function Bars({ rows, label, format = formatCount }: { rows: { key: string; label: React.ReactNode; value: number; note?: string; tone?: "warn" }[]; label: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <ul className="ins-bars" aria-label={label}>
    {rows.map(r => <li key={r.key} className="ins-bar-row" data-tone={r.tone}>
      <span title={typeof r.label === "string" ? r.label : undefined}>{r.label}</span>
      <span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" data-zero={r.value === 0 ? "" : undefined} style={{ width: `${r.value / max * 100}%` }} /></span>
      <span className="ins-bar-value">{format(r.value)}{r.note ? <span className="sr-only"> {r.note}</span> : null}</span>
    </li>)}
  </ul>;
}

export function Flag({ tone, children }: { tone?: "warn" | "bad" | "good" | "info"; children: React.ReactNode }) {
  return <span className="ins-flag" data-tone={tone}>{children}</span>;
}

/** Attention rows: a count, what it is, where to go. */
export function Attention({ items }: { items: { key: string; count: number; title: string; hint: string; href?: string; tone?: "warn" | "bad" | "good" }[] }) {
  return <ul className="ins-attention">
    {items.map(item => {
      const body = <><span className="ins-attention-count">{formatCount(item.count)}</span><span><span className="ins-attention-title">{item.title}</span><span className="ins-attention-hint">{item.hint}</span></span>{item.href ? <ArrowRight aria-hidden="true" className="size-4 text-ui-muted-foreground" /> : <span />}</>;
      return <li key={item.key} data-tone={item.count ? item.tone : "good"}>{item.href ? <Link href={item.href}>{body}</Link> : <div className="ins-attention-row">{body}</div>}</li>;
    })}
  </ul>;
}
