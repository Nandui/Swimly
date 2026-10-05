import { EmptyState } from "@/components/ui-kit/empty-state";
import Link from "next/link";
import { CalendarX2, ChevronRight, TriangleAlert, UserPlus, Users, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AnalyticsRefresh } from "./refresh";
import { AnalyticsNav } from "./navigation";
import type { AnalyticsData } from "@/modules/activities/lib/analytics/data";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { formatCount, formatDateRange, formatDateTime, formatDayMonth, formatMonth, formatWeekday, plural } from "@/lib/format";
import { StatTile } from "./stat-tile";

const percent = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const period = formatDateRange(data.period.weekStart, data.period.weekEnd);
  const month = formatMonth(data.period.monthStart);
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Analytics" description={`${data.siteName} · Enrolment and class activity`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="overview" />
    <ul className="pc-stats" aria-label="Enrolment at a glance">
      <StatTile icon={Users} value={formatCount(data.swimmers)} label="Total swimmers enrolled" caption={`Across ${plural(data.places, "class place")}. Each swimmer counted once.`} />
      <StatTile icon={UserPlus} value={formatCount(data.enrolled)} label="Enrolments" caption={`This week, ${period}`} />
      <StatTile icon={UserX} value={formatCount(data.withdrawn)} label="Unenrolments" caption={`This week, ${period}`} />
    </ul>
    <div className="pc-grid">
      <section className="pc-panel" aria-labelledby="enrolled-by-level">
        <div className="pc-panel-head"><h2 id="enrolled-by-level">Enrolled by level</h2></div>
        <p className="text-xs text-ui-muted-foreground">Enrolled places of the total across each level’s weekly classes.</p>
        {data.swimmers === 0 ? <EmptyState compact title="No swimmers are currently enrolled in this view." /> : null}
        {data.groups.length === 0 ? <p className="text-sm text-ui-muted-foreground">Levels will appear here once the curriculum is set up.</p> : data.groups.map(group => <section key={group.id} aria-labelledby={`programme-${group.id}`} className="flex min-w-0 flex-col gap-2">
          <h3 id={`programme-${group.id}`} className="text-xs font-semibold text-ui-muted-foreground">{group.name}</h3>
          <ul className="pc-rows">{group.levels.map(level => <li key={level.id} className="pc-row flex-col gap-2">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="pc-row-title flex min-w-0 flex-wrap items-center gap-2">{level.name}{level.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}</span>
              <span className="text-sm tabular-nums">
                {formatCount(level.count)}<span className="sr-only"> enrolled places</span>
                {level.capacity === null ? " · No limit" : <> of {formatCount(level.capacity)}<span className="sr-only"> total places</span></>}
                {level.percentage !== null ? ` · ${percent.format(level.percentage)}% filled` : null}
                {level.capacity !== null && level.count > level.capacity ? <span className="sr-only"> · {formatCount(level.count - level.capacity)} over capacity</span> : null}
              </span>
            </div>
            {level.percentage !== null ? <div className="w-full" aria-hidden="true"><Progress value={Math.min(100, level.percentage)} /></div> : <span className="pc-row-hint w-full">
              {level.capacity === null ? "Includes classes with no limit" : level.classes === 0 ? "No classes" : level.count > 0 ? `${formatCount(level.count)} over capacity` : "No places configured"}
            </span>}
          </li>)}</ul>
        </section>)}
      </section>
      <section className="pc-panel" aria-labelledby="class-cancellations">
        <div className="pc-panel-head"><h2 id="class-cancellations">Class cancellations</h2></div>
        <ul className="pc-stats" aria-label={`Cancellations in ${month}`}>
          <StatTile icon={CalendarX2} value={formatCount(data.cancellations.sessions)} label="This month" caption={`Cancelled sessions · ${plural(data.cancellations.affectedPlaces, "swimmer booking")} affected`} />
          <StatTile icon={TriangleAlert} value={formatCount(data.cancellations.pending)} label="Awaiting billing" caption={`${formatCount(data.cancellations.notified)} billing notified`} />
        </ul>
        {data.canOpenCancellations ? <Button asChild variant="outline" className="self-start"><Link href="/cancellations">Cancelled classes<ChevronRight aria-hidden="true" /></Link></Button> : null}
      </section>
    </div>
    <section className="pc-panel" aria-labelledby="daily-activity">
      <div className="pc-panel-head"><h2 id="daily-activity">Daily activity</h2></div>
      <Table>
        <TableCaption className="sr-only">Enrolments and unenrolments recorded this Monday to Sunday. Future days have no activity yet.</TableCaption>
        <TableHeader><TableRow>
          <TableHead scope="col">Day</TableHead>
          <TableHead scope="col" className="text-right">Enrolled</TableHead>
          <TableHead scope="col" className="text-right">Unenrolled</TableHead>
        </TableRow></TableHeader>
        <TableBody>{data.daily.map(row => <TableRow key={row.day}>
          <TableHead scope="row">{row.day === data.period.date ? <><span className="font-semibold">Today</span>, {formatWeekday(row.day)}</> : formatWeekday(row.day)}<span className="sr-only"> {formatDayMonth(row.day)}</span></TableHead>
          <TableCell className="text-right tabular-nums">{row.day > data.period.date ? <span aria-label="Upcoming">—</span> : formatCount(row.enrolled)}</TableCell>
          <TableCell className="text-right tabular-nums">{row.day > data.period.date ? <span aria-label="Upcoming">—</span> : formatCount(row.withdrawn)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <p className="text-xs text-ui-muted-foreground">Updated {formatDateTime(new Date(data.updatedAt))} · Europe/Dublin</p>
    </section>
    <p className="max-w-prose text-xs text-ui-muted-foreground">Totals exclude waitlists, future starts, inactive swimmers and archived classes. Weekly figures count recorded actions, not a net change in swimmers.</p>
  </div>;
}
