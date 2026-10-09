import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { ScoreTrend } from "@/modules/tasks/components/score-trend";
import { TaskStateTag } from "@/modules/tasks/components/status";
import { formatDate, formatDayMonth, parseDateOnly } from "@/lib/format";
import { REPORT_FILTERS, taskReport, type ReportInterval } from "@/modules/tasks/lib/data";
import { SCORE_BAND_META, scoreBand } from "@/modules/tasks/lib/rules";

export const metadata: Metadata = { title: "Reports" };

const INTERVAL_LABELS: Record<ReportInterval, string> = { day: "Daily", week: "Weekly", month: "Monthly" };
const periodLabel = (p: string, interval: ReportInterval) =>
  interval === "month" ? new Intl.DateTimeFormat("en-IE", { month: "short", year: "numeric", timeZone: "UTC" }).format(parseDateOnly(`${p}-01`))
    : interval === "week" ? `Week of ${formatDayMonth(p)}` : formatDayMonth(p);

/** A score with its band (good, fair, low): the number is always shown, the band's tone and icon add to it. */
function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ui-muted-foreground">None</span>;
  return <Tag meta={SCORE_BAND_META[scoreBand(value)]} label={`${value}%`} />;
}

/** See how the sites are doing (the prototype's Reports): Site scores (the average, the score
 *  over time and each site's scores by day, week or month, with finished days frozen nightly) and
 *  Task reports (every task in the range, filtered by status, words and tag). Each tab downloads
 *  its own CSV. For reviewers, at the sites they review. */
export default async function TaskReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; interval?: string; site?: string; status?: string; q?: string; tag?: string }> }) {
  const input = await searchParams;
  const tab = input.tab === "tasks" ? "tasks" : "scores";
  const r = await taskReport(input);
  const base = { from: r.from, to: r.to, interval: r.interval, ...(r.site ? { site: r.site } : {}) };
  const href = (extra: Record<string, string>) => `/tasks/reports?${new URLSearchParams({ ...base, tab, ...extra })}`;
  const exportHref = `/tasks/reports/export?${new URLSearchParams({ ...base, kind: tab, ...(tab === "tasks" ? { status: r.filters.status, q: r.filters.q, tag: r.filters.tag } : {}) })}`;
  const focus = r.bySite.find((s) => s.id === r.site) ?? r.bySite[0];
  return (
    <>
      <PageHeader
        title="Reports"
        description="Completion, consistency and the details behind every score. Done on time counts in full, done late half, missed or can't complete nothing."
        actions={<Button asChild variant="outline"><a href={exportHref}><Download aria-hidden="true" />Export report</a></Button>}
      />
      <SegmentedLinks label="Report type" items={[
        { href: href({ tab: "scores" }), label: "Site scores", current: tab === "scores" },
        { href: href({ tab: "tasks" }), label: "Task reports", current: tab === "tasks" },
      ]} />
      <section className="pc-panel" aria-label="Report range">
        <form method="get" className="flex flex-wrap items-end gap-4" aria-label="Choose the range">
          <input type="hidden" name="tab" value={tab} />
          <div className="space-y-2"><Label htmlFor="report-from" className="block">From</Label><Input id="report-from" name="from" type="date" defaultValue={r.from} max={r.to} className="min-h-11" /></div>
          <div className="space-y-2"><Label htmlFor="report-to" className="block">To</Label><Input id="report-to" name="to" type="date" defaultValue={r.to} className="min-h-11" /></div>
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-52"><Label htmlFor="report-site" className="block">Site</Label>
            <NativeSelect id="report-site" name="site" defaultValue={r.site ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">Every site you review</NativeSelectOption>
              {r.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          {tab === "scores" ? (
            <div className="min-w-0 grow basis-32 space-y-2 sm:grow-0 sm:min-w-36"><Label htmlFor="report-interval" className="block">Score interval</Label>
              <NativeSelect id="report-interval" name="interval" defaultValue={r.interval} className="min-h-11 w-full">
                {(Object.keys(INTERVAL_LABELS) as ReportInterval[]).map((k) => <NativeSelectOption key={k} value={k}>{INTERVAL_LABELS[k]}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          ) : (
            <>
              <input type="hidden" name="interval" value={r.interval} />
              <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-44"><Label htmlFor="report-status" className="block">Status</Label>
                <NativeSelect id="report-status" name="status" defaultValue={r.filters.status} className="min-h-11 w-full">
                  {Object.entries(REPORT_FILTERS).map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}
                </NativeSelect></div>
              <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-40"><Label htmlFor="report-tag" className="block">Tag</Label>
                <NativeSelect id="report-tag" name="tag" defaultValue={r.filters.tag} className="min-h-11 w-full">
                  <NativeSelectOption value="">All tags</NativeSelectOption>
                  {r.tags.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                </NativeSelect></div>
              <SearchField label="Search tasks" placeholder="Task or tag" name="q" defaultValue={r.filters.q} className="grow basis-56" />
            </>
          )}
          <Button type="submit" className="min-h-11">Show</Button>
        </form>
        <p className="text-xs text-ui-muted-foreground">Up to 92 days at a time.</p>
      </section>

      {r.bySite.length === 0 ? <EmptyState as="h2" icon="building" title="No sites to report on" hint="Tasks: Review at a site shows its reports." /> : tab === "scores" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
            <section className="pc-panel" aria-labelledby="report-average">
              <div className="pc-panel-head"><h2 id="report-average">Average score</h2></div>
              <p className="pc-stat-figure">{focus.score === null ? "None" : `${focus.score}%`}</p>
              {focus.score !== null ? <Tag meta={SCORE_BAND_META[scoreBand(focus.score)]} /> : null}
              <p className="text-sm text-ui-muted-foreground">{focus.name} · {focus.scoredDays} scored {focus.scoredDays === 1 ? "day" : "days"}{r.bySite.length > 1 && r.average !== null ? ` · every site ${r.average}%` : ""}</p>
              <p className="text-xs text-ui-muted-foreground">On time 100% · late 50% · missed 0%</p>
            </section>
            <section className="pc-panel" aria-labelledby="report-trend">
              <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="report-trend">Consistency over time</h2><p className="pc-row-hint">{focus.name}, {INTERVAL_LABELS[r.interval].toLowerCase()}. Choose a site above to see another.</p></div></div>
              <ScoreTrend site={focus.name} points={r.periods.map((p, i) => ({ label: periodLabel(p, r.interval), value: focus.periods[i].score }))} />
            </section>
          </div>

          <section className="pc-panel" aria-labelledby="report-sites">
            <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="report-sites">Site performance</h2><p className="pc-row-hint">{formatDate(parseDateOnly(r.from))} to {formatDate(parseDateOnly(r.to))}. Finished days are frozen each night; today stays provisional until the day closes.</p></div></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">Site</TableHead><TableHead scope="col">Average</TableHead>
                <TableHead scope="col" className="text-right">Tasks</TableHead><TableHead scope="col" className="text-right">Missed</TableHead>
                <TableHead scope="col" className="text-right">Late</TableHead><TableHead scope="col" className="text-right">Out of range</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {r.bySite.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold">{s.name}{s.area ? <span className="block text-xs font-normal text-ui-muted-foreground">{s.area}</span> : null}</TableCell>
                    <TableCell><Score value={s.score} /></TableCell>
                    <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.missed}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.late}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.exceptions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="pc-panel" aria-labelledby="report-periods">
            <div className="pc-panel-head"><h2 id="report-periods">Scores by {r.interval === "day" ? "day" : r.interval === "week" ? "week" : "month"}</h2></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">{r.interval === "day" ? "Day" : r.interval === "week" ? "Week" : "Month"}</TableHead>
                {r.bySite.map((s) => <TableHead key={s.id} scope="col">{s.name}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {r.periods.map((p, i) => (
                  <TableRow key={p}>
                    <TableCell>{periodLabel(p, r.interval)}</TableCell>
                    {r.bySite.map((s) => <TableCell key={s.id}><Score value={s.periods[i].score} /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      ) : (
        <section className="pc-panel" aria-labelledby="report-tasks">
          <div className="pc-panel-head"><h2 id="report-tasks">Task reports <span className="text-ui-muted-foreground tabular-nums">· {r.tasks.length}</span></h2></div>
          {r.tasks.length === 0 ? <EmptyState compact icon="clipboardCheck" title="No matching tasks" hint="Change the range or the filters to see more." /> : (
            <ul className="pc-rows">
              {r.tasks.slice(0, 300).map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{t.title}</span>
                      <span className="pc-row-hint">{[t.siteName, formatDayMonth(t.date), t.completedByName ? `by ${t.completedByName}` : null, ...t.exceptionList, t.reason || null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="pc-row-trail"><TaskStateTag state={t.state} /><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {r.tasks.length > 300 ? <p className="text-xs text-ui-muted-foreground">Showing the first 300; the export has all {r.tasks.length}.</p> : null}
        </section>
      )}
    </>
  );
}
