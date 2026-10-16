import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatDate } from "@/lib/format";
import type { TrainingReport } from "@/modules/training/features/insight/server/data";
import { days, Figure, filterQuery, pct } from "@/modules/training/features/insight/components/parts";

const MAX_ROWS = 300;

function ReportDownload({ kind, report }: { kind: "overdue" | "courses"; report: TrainingReport }) {
  const q = filterQuery(report.filters);
  return (
    <Button asChild variant="outline" className="min-h-11 print:hidden">
      <a href={`/training/reports/export${q ? `${q}&` : "?"}kind=${kind}`} download><Download aria-hidden="true" />Download for Excel</a>
    </Button>
  );
}

/** Open and overdue training by site or by line manager. */
function Groups({ id, title, hint, lines }: { id: string; title: string; hint: string; lines: TrainingReport["bySite"] }) {
  return (
    <section aria-labelledby={id} className="pc-panel">
      <div className="space-y-1">
        <h2 id={id}>{title}</h2>
        <p className="text-sm text-ui-muted-foreground">{hint}</p>
      </div>
      {lines.length ? (
        <Table>
          <TableCaption className="sr-only">{title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="p-3">{title.replace("Overdue by ", "").replace(/^./, (c) => c.toUpperCase())}</TableHead>
              <TableHead scope="col" className="p-3 text-right">Open</TableHead>
              <TableHead scope="col" className="p-3 text-right">Overdue</TableHead>
              <TableHead scope="col" className="p-3 text-right">People late</TableHead>
              <TableHead scope="col" className="p-3 text-right">Longest late</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableHead scope="row" className="h-auto p-3 font-medium">{l.name}</TableHead>
                <TableCell className="p-3 text-right tabular-nums">{l.open}</TableCell>
                <TableCell className={`p-3 text-right tabular-nums ${l.overdue ? "font-semibold text-ui-destructive" : ""}`}>{l.overdue}</TableCell>
                <TableCell className="p-3 text-right tabular-nums">{l.people}</TableCell>
                <TableCell className="p-3 text-right tabular-nums">{l.overdue ? days(l.longest) : "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p className="text-sm text-ui-muted-foreground">No open training.</p>}
    </section>
  );
}

/** The Training reports page (e-learning phase 7): how the people the reader covers stand, where
 *  training is late and with whom, and each course's numbers, with downloads for Excel. */
export function ReportView({ report }: { report: TrainingReport }) {
  const { totals } = report;
  if (!report.people) return <EmptyState as="h2" icon="graduation" title="Nobody here" hint="No one you cover matches these filters." />;
  return (
    <div className="flex flex-col gap-6">
      <div className="pc-stats pc-stats-fill">
        <Figure value={totals.open} label="Open training" hint={`For ${report.people} ${report.people === 1 ? "person" : "people"}`} />
        <Figure value={totals.overdue} label="Overdue" hint={totals.overdue ? `${pct(totals.inDate)} of all training is on time` : "Nothing is late"} />
        <Figure value={totals.awaitingSignoff} label="Waiting for sign-off" hint="Handed in for a practical" />
        <Figure value={totals.completedLately} label="Completed" hint="In the past 30 days" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Groups id="report-sites" title="Overdue by site" hint="Someone who works at two sites counts at both." lines={report.bySite} />
        <Groups id="report-managers" title="Overdue by manager" hint="By each person's line manager, set in HR." lines={report.byManager} />
      </div>

      <section aria-labelledby="report-overdue" className="pc-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="report-overdue">Overdue training · {report.overdue.length}</h2>
            <p className="text-sm text-ui-muted-foreground">Longest late first.{report.overdue.length > MAX_ROWS ? ` The first ${MAX_ROWS}; the download has them all.` : ""}</p>
          </div>
          {report.overdue.length ? <ReportDownload kind="overdue" report={report} /> : null}
        </div>
        {report.overdue.length ? (
          <Table>
            <TableCaption className="sr-only">Overdue training, longest late first</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="p-3">Person</TableHead>
                <TableHead scope="col" className="p-3">Course</TableHead>
                <TableHead scope="col" className="p-3">Due</TableHead>
                <TableHead scope="col" className="p-3">Where they are</TableHead>
                <TableHead scope="col" className="p-3">Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.overdue.slice(0, MAX_ROWS).map((o) => (
                <TableRow key={o.id}>
                  <TableHead scope="row" className="h-auto p-3 font-medium">
                    <Link href={`/training/people/${o.userId}`} className="underline-offset-4 hover:underline">{o.name}</Link>
                    <span className="block text-xs font-normal text-ui-muted-foreground">{o.sites}</span>
                  </TableHead>
                  <TableCell className="p-3"><Link href={`/training/courses/${o.course.id}/insight`} className="underline-offset-4 hover:underline">{o.course.title}</Link></TableCell>
                  <TableCell className="p-3 tabular-nums">{formatDate(o.dueOn)}<span className="block text-xs text-ui-muted-foreground">{days(o.daysLate)} late</span></TableCell>
                  <TableCell className="p-3 text-sm">{o.stage.replace(", overdue", "")}</TableCell>
                  <TableCell className="p-3 text-sm">{o.manager ?? <span className="text-ui-muted-foreground">No manager set</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-ui-muted-foreground">Nothing is overdue.</p>}
      </section>

      <section aria-labelledby="report-courses" className="pc-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="report-courses">Courses</h2>
            <p className="text-sm text-ui-muted-foreground">Each course the people here were given. Open one to see where people stop.</p>
          </div>
          {report.courses.length ? <ReportDownload kind="courses" report={report} /> : null}
        </div>
        {report.courses.length ? (
          <Table>
            <TableCaption className="sr-only">Each course and how the people here are doing on it</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="p-3">Course</TableHead>
                <TableHead scope="col" className="p-3 text-right">Given</TableHead>
                <TableHead scope="col" className="p-3 text-right">Completed</TableHead>
                <TableHead scope="col" className="p-3 text-right">Overdue</TableHead>
                <TableHead scope="col" className="p-3 text-right">Passed first time</TableHead>
                <TableHead scope="col" className="p-3 text-right">To finish</TableHead>
                <TableHead scope="col" className="p-3 text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.courses.map((c) => (
                <TableRow key={c.id}>
                  <TableHead scope="row" className="h-auto p-3 font-medium"><Link href={`/training/courses/${c.id}/insight`} className="underline-offset-4 hover:underline">{c.title}</Link></TableHead>
                  <TableCell className="p-3 text-right tabular-nums">{c.assigned}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{c.completed} · {pct(c.completion)}</TableCell>
                  <TableCell className={`p-3 text-right tabular-nums ${c.overdue ? "font-semibold text-ui-destructive" : ""}`}>{c.overdue}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{pct(c.firstTime)}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{days(c.daysToFinish)}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{c.rating?.average != null ? `${c.rating.average} of 5` : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-ui-muted-foreground">Nobody here has been given a course yet.</p>}
      </section>
    </div>
  );
}
