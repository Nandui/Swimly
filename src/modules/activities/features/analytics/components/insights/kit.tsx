import Link from "next/link";
import * as React from "react";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Progress } from "@/components/shadcn/progress";
import { addDaysIso, formatCount, formatDateRange, formatDateTime, formatDayMonth } from "@/lib/format";
import { DashboardSwitch, dashboardOf, type AnalyticsPage } from "@/modules/activities/features/analytics/components/navigation";
import { AnalyticsRefresh } from "@/modules/activities/features/analytics/components/refresh";
import { FilterBar, type FilterBarProps } from "@/modules/activities/features/analytics/components/insights/filters";
import { AreaChart, FlowChart, Sparkline, type ChartKind } from "@/modules/activities/features/analytics/components/insights/charts";
export { Meter } from "@/modules/activities/features/analytics/components/insights/meter";
export { ColumnChart } from "@/modules/activities/features/analytics/components/insights/charts";
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

/** The frame every analytics page shares: the title with one line saying exactly what is shown, then
 *  one sticky bar that starts with the three dashboards and carries every filter after it, then the
 *  figures. A page behind a dashboard (every class, one teacher) gets a link back to it instead of
 *  the eyebrow. `programme` is false on pages the programme does not narrow (reception work is not
 *  tied to a programme). */
export function ReportShell({ ctx, page, path, title, description, back, children, footnotes, programme = true, actions }: {
  ctx: ReportContext; page: AnalyticsPage; path: string; title: string; description?: string;
  /** For a page behind a dashboard: where "back" goes, the dashboard itself unless given. */
  back?: { href: string; label: string } | true; children: React.ReactNode; footnotes?: React.ReactNode[];
  programme?: boolean; actions?: React.ReactNode;
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
    reset: defaults ? null : path,
  };
  const scope = [ctx.siteName, ctx.programme && programme ? ctx.programme.name : null].filter(Boolean).join(" · ");
  const context = [scope, periodText(period), `compared with ${formatDateRange(period.previousStart, period.previousEnd)}`, period.current ? null : `"now" figures as of ${formatDayMonth(period.end)}`].filter(Boolean).join(" · ");
  const dashboard = dashboardOf(page);
  const backTo = back === true ? { href: reportHref(ctx, dashboard.href), label: dashboard.label } : back;
  return <PageShell className="ins" data-dashboard={dashboard.key}
    header={<PageHeader title={title} back={backTo} eyebrow={backTo ? null : <p className="ins-eyebrow">Swim school analytics</p>}
      description={description ? <>{description}<span className="ins-context">{context}</span></> : context} actions={<>{actions}<AnalyticsRefresh /></>} />}>
    <FilterBar {...bar} switcher={<DashboardSwitch page={page} query={filterQuery(ctx)} />} />
    <div className="ins-body">{children}</div>
    <footer className="ins-footnote">
      {footnotes?.map((note, i) => <p key={i}>{note}</p>)}
      {programme && ctx.programme ? <p>Only {ctx.programme.name}: its classes, places, waiting lists and passes. A move into another programme counts as leaving this one.</p> : null}
      <p>Compared with the {period.label} before, {formatDateRange(period.previousStart, period.previousEnd)}. Updated {formatDateTime(new Date(ctx.updatedAt))} · Europe/Dublin.</p>
    </footer>
  </PageShell>;
}

/** A group of panels that answer one question, laid out as a bento grid. */
export function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return <section id={id} className="ins-section" aria-labelledby={`${id}-title`}>
    <header className="ins-section-head">
      <h2 id={`${id}-title`}>{title}</h2>
      {intro ? <p>{intro}</p> : null}
    </header>
    <div className="ins-bento">{children}</div>
  </section>;
}

/** How many of the bento's twelve columns a panel takes on wide screens. */
export type Span = 12 | 8 | 7 | 6 | 5 | 4 | 3;

export function Panel({ id, title, sub, action, children, className, span = 12, figure }: {
  id: string; title: string; sub?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; span?: Span;
  /** A headline number for the panel, shown beside its title. */
  figure?: React.ReactNode;
}) {
  return <section id={id} className={`pc-panel ins-panel${className ? ` ${className}` : ""}`} data-span={span} aria-labelledby={`${id}-heading`}>
    <div className="ins-head">
      <div className="ins-head-text">
        <h3 id={`${id}-heading`}>{title}</h3>
        {sub ? <p className="ins-sub">{sub}</p> : null}
      </div>
      {action}
    </div>
    {figure ? <div className="ins-panel-figure">{figure}</div> : null}
    {children}
  </section>;
}

/** The headline figures as one strip of cells, in even rows whatever their number. */
export function KpiStrip({ label, children, span = 12 }: { label: string; children: React.ReactNode; span?: Span }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  return <ul className="ins-kpis" aria-label={label} data-count={count} data-span={span}>{children}</ul>;
}

/** The pages behind a dashboard, as tiles at its end: what each holds and a way in. */
export function DrillLinks({ label, links }: { label: string; links: { href: string; title: string; hint: string; icon: LucideIcon; count?: string }[] }) {
  return <ul className="ins-drill" aria-label={label}>
    {links.map(({ href, title, hint, icon: Icon, count }) => <li key={href}>
      <Link href={href} className="ins-drill-link">
        <span className="ins-drill-icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
        <span className="min-w-0"><span className="ins-drill-title">{title}{count ? <span className="ins-drill-count">{count}</span> : null}</span><span className="ins-drill-hint">{hint}</span></span>
        <ArrowRight aria-hidden="true" className="ins-drill-go" />
      </Link>
    </li>)}
  </ul>;
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="ins-panel-link">{children}<ArrowRight aria-hidden="true" /></Link>;
}

/** One headline figure: what it is, the value, a note, and optionally its recent
 *  trend or a fill meter. With `href` the whole cell opens the page behind it. */
export function Kpi({ label, value, unit, note, href, spark, meter }: {
  label: string; value: React.ReactNode; unit?: string; note?: React.ReactNode; href?: string;
  spark?: (number | null)[]; meter?: number | null;
}) {
  const body = <>
    <span className="ins-kpi-label">{label}{href ? <ArrowUpRight aria-hidden="true" className="ins-kpi-go" /> : null}</span>
    <span className="ins-kpi-line">
      <span className="ins-kpi-value">{value}{unit ? <small>{unit}</small> : null}</span>
    </span>
    {spark ? <Sparkline values={spark} /> : null}
    {meter !== undefined && meter !== null ? <Progress value={Math.min(100, meter)} aria-hidden="true" className="ins-kpi-meter" /> : null}
    {note ? <span className="ins-kpi-note">{note}</span> : null}
  </>;
  return <li className="ins-kpi-cell">{href ? <Link href={href} className="ins-kpi">{body}</Link> : <div className="ins-kpi">{body}</div>}</li>;
}

/** A line over time, to scale from zero, every week readable on hover or with the arrow keys. */
export function TrendChart({ points, label, kind, unit, height, compare }: {
  points: { x: string; y: number; label: string }[]; label: string; kind?: ChartKind; unit?: string; height?: number;
  compare?: { label: string; values: (number | null)[] };
}) {
  return <AreaChart label={label} unit={unit} kind={kind} height={height} compare={compare} points={points.map(p => ({ x: p.x, tick: formatDayMonth(p.x), y: p.y, title: p.label }))} />;
}

/** Two series per period (joined and left): the first rises, the second falls below the line. */
export function PairedColumns({ rows, a, b, label, height }: { rows: { key: string; label: string; title?: string; a: number; b: number }[]; a: string; b: string; label: string; height?: number }) {
  return <FlowChart label={label} a={a} b={b} height={height} rows={rows.map(r => ({ key: r.key, tick: r.label, title: r.title ?? r.label, a: r.a, b: r.b }))} />;
}

/** Horizontal bars to one scale, with the number and its share at the end. */
export function Bars({ rows, label, format = formatCount, share }: {
  rows: { key: string; label: React.ReactNode; value: number; note?: string; tone?: "warn" }[]; label: string; format?: (n: number) => string;
  /** Show each row's share of the total beside its value. */
  share?: boolean;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return <ul className="ins-bars" aria-label={label}>
    {rows.map(r => <li key={r.key} className="ins-bar-row" data-tone={r.tone}>
      <span className="ins-bar-label" title={typeof r.label === "string" ? r.label : undefined}>{r.label}</span>
      <Progress value={Math.min(100, (r.value / max) * 100)} aria-hidden="true" className="ins-bar-track" />
      <span className="ins-bar-value">{format(r.value)}{share && total ? <span className="ins-bar-share">{whole.format(r.value / total * 100)}%</span> : null}{r.note ? <span className="sr-only"> {r.note}</span> : null}</span>
    </li>)}
  </ul>;
}

export function Flag({ tone, children }: { tone?: "warn" | "bad" | "good" | "info"; children: React.ReactNode }) {
  return <span className="ins-flag" data-tone={tone}>{children}</span>;
}

/** Attention rows: a count, what it is, where to go. */
export function Attention({ items, columns }: { items: { key: string; count: number; title: string; hint: string; href?: string; tone?: "warn" | "bad" | "good" }[]; columns?: boolean }) {
  return <ul className="ins-attention" data-columns={columns ? "" : undefined}>
    {items.map(item => {
      const body = <><span className="ins-attention-count">{formatCount(item.count)}</span><span className="min-w-0"><span className="ins-attention-title">{item.title}</span><span className="ins-attention-hint">{item.hint}</span></span>{item.href ? <ArrowRight aria-hidden="true" className="ins-attention-go" /> : <span />}</>;
      return <li key={item.key} data-tone={item.count ? item.tone : "good"}>{item.href ? <Link href={item.href}>{body}</Link> : <div className="ins-attention-row">{body}</div>}</li>;
    })}
  </ul>;
}

/** The scale under a heat map: from fewest to most, in the map's own shades. */
export function HeatLegend({ low, high, waiting }: { low: string; high: string; waiting?: string }) {
  return <div className="ins-heat-legend" aria-hidden="true">
    <span>{low}</span>
    <span className="ins-heat-scale">{[1, 2, 3, 4].map(b => <span key={b} data-band={b} />)}</span>
    <span>{high}</span>
    {waiting ? <span className="ins-heat-waiting"><span />{waiting}</span> : null}
  </div>;
}
