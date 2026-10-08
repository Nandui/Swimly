import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Input } from "@/components/shadcn/input";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { TaskStateTag } from "@/components/tasks/status";
import { formatDate, formatDayMonth, parseDateOnly } from "@/lib/format";
import { taskReport, type ReportInterval } from "@/lib/tasks/data";

export const metadata: Metadata = { title: "Reports" };

const INTERVAL_LABELS: Record<ReportInterval, string> = { day: "By day", week: "By week", month: "By month" };
const periodLabel = (p: string, interval: ReportInterval) =>
  interval === "month" ? new Intl.DateTimeFormat("en-IE", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDateOnly(`${p}-01`))
    : interval === "week" ? `Week of ${formatDayMonth(p)}` : formatDate(parseDateOnly(p));
const pct = (v: number | null) => (v === null ? "None" : `${v}%`);

/** How consistently the sites a reviewer covers do their tasks: each site's score over the
 *  range, by day, week or month, and the readings that were out of range. The export has
 *  every task in the range. */
export default async function TaskReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; interval?: string; site?: string }> }) {
  const input = await searchParams;
  const r = await taskReport(input);
  const params = (extra: Record<string, string>) => new URLSearchParams({ from: r.from, to: r.to, interval: r.interval, ...(r.site ? { site: r.site } : {}), ...extra });
  const flagged = r.tasks.filter((t) => t.exceptions > 0 || t.state === "cant_complete").slice(-50).reverse();
  return (
    <>
      <PageHeader
        title="Reports"
        description="Each site's score: done on time counts in full, done late half, missed or can't complete nothing. Not applicable and tasks not yet due are left out."
        actions={<Button asChild variant="outline"><a href={`/tasks/reports/export?${params({})}`}><Download aria-hidden="true" />Download CSV</a></Button>}
      />
      <section className="pc-panel" aria-label="Report range">
        <form method="get" className="flex flex-wrap items-end gap-4" aria-label="Choose the range">
          <input type="hidden" name="interval" value={r.interval} />
          <div className="space-y-2"><Label htmlFor="report-from" className="block">From</Label><Input id="report-from" name="from" type="date" defaultValue={r.from} max={r.to} className="min-h-11" /></div>
          <div className="space-y-2"><Label htmlFor="report-to" className="block">To</Label><Input id="report-to" name="to" type="date" defaultValue={r.to} className="min-h-11" /></div>
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-52"><Label htmlFor="report-site" className="block">Site</Label>
            <NativeSelect id="report-site" name="site" defaultValue={r.site ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">Every site you review</NativeSelectOption>
              {r.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <Button type="submit" className="min-h-11">Show</Button>
        </form>
        <p className="text-xs text-ui-muted-foreground">Up to 92 days at a time.</p>
        <SegmentedLinks label="Group the scores" items={(Object.keys(INTERVAL_LABELS) as ReportInterval[]).map((k) => ({ href: `/tasks/reports?${params({ interval: k })}`, label: INTERVAL_LABELS[k], current: k === r.interval }))} />
      </section>

      {r.bySite.length === 0 ? <EmptyState as="h2" icon="building" title="No sites to report on" hint="Tasks: Review at a site shows its reports." /> : (
        <>
          <section className="pc-panel" aria-labelledby="report-sites">
            <div className="pc-panel-head"><h2 id="report-sites">Sites, {formatDate(parseDateOnly(r.from))} to {formatDate(parseDateOnly(r.to))}</h2></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">Site</TableHead><TableHead scope="col" className="text-right">Score</TableHead><TableHead scope="col" className="text-right">Tasks</TableHead>
                <TableHead scope="col" className="text-right">Missed</TableHead><TableHead scope="col" className="text-right">Late</TableHead><TableHead scope="col" className="text-right">Out of range</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {r.bySite.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold">{s.name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{pct(s.score)}</TableCell>
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
            <div className="pc-panel-head"><h2 id="report-periods">Score over time</h2></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">{r.interval === "day" ? "Day" : r.interval === "week" ? "Week" : "Month"}</TableHead>
                {r.bySite.map((s) => <TableHead key={s.id} scope="col" className="text-right">{s.name}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {r.periods.map((p, i) => (
                  <TableRow key={p}>
                    <TableCell>{periodLabel(p, r.interval)}</TableCell>
                    {r.bySite.map((s) => <TableCell key={s.id} className="text-right tabular-nums">{pct(s.periods[i].score)}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="pc-panel" aria-labelledby="report-flagged">
            <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="report-flagged">Out of range or not done</h2><p className="pc-row-hint">The latest 50 in the range.</p></div></div>
            {flagged.length === 0 ? <EmptyState compact icon="clipboardCheck" title="Nothing out of range" /> : (
              <ul className="pc-rows">
                {flagged.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="pc-row">
                      <span className="pc-row-body">
                        <span className="pc-row-title">{t.title}</span>
                        <span className="pc-row-hint">{[t.siteName, formatDayMonth(t.date), ...t.exceptionList, t.reason || null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="pc-row-trail"><TaskStateTag state={t.state} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
