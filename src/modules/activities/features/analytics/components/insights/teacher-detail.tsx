import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatDate, formatDayMonth, formatShortDay, formatTime, parseDateOnly } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { OneTeacherInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { Bars, decimal, Flag, Kpi, KpiStrip, Meter, Panel, percent, reportHref, ReportShell, Section, TrendChart, weeks } from "@/modules/activities/features/analytics/components/insights/kit";

type Detail = NonNullable<OneTeacherInsights["detail"]>;

function Compare({ label, mine, school, format = percent, lowerBetter }: { label: string; mine: number | null; school: number | null; format?: (n: number | null) => string; lowerBetter?: boolean }) {
  const max = Math.max(1, mine ?? 0, school ?? 0, lowerBetter ? 0 : 100);
  const worse = mine !== null && school !== null && (lowerBetter ? mine > school + 10 : mine < school - 10);
  return <li>
    <span className="ins-kpi-label">{label}</span>
    <span className="ins-compare-line"><span>This teacher</span><span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" style={{ width: `${(mine ?? 0) / max * 100}%` }} /></span><strong className="ins-num">{format(mine)}</strong></span>
    <span className="ins-compare-line" data-who="school"><span>School</span><span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" style={{ width: `${(school ?? 0) / max * 100}%` }} /></span><span className="ins-num">{format(school)}</span></span>
    {worse ? <Flag tone="warn">Worse than the school</Flag> : null}
  </li>;
}

export function TeacherDetailReport({ data }: { data: OneTeacherInsights & { detail: Detail } }) {
  const { teacher: t, school, weeks: byWeek, classes, leavers, late, missed } = data.detail;
  return <ReportShell ctx={data} page="teachers" path={`/analytics/teachers/${encodeURIComponent(t.key)}`} back={{ href: reportHref(data, "/analytics/teachers"), label: "Teachers" }} title={t.name} footnotes={[
    "Lessons are the ones this teacher started on the pool deck. Left after counts swimmers who left the swim school when this teacher taught the last lesson they came to.",
    "Compared with every lesson at the same sites in the same period.",
  ]}>
    <Section id="glance" eyebrow="At a glance" title="Their figures">
    <KpiStrip label={`${t.name} at a glance`}>
      <Kpi label="Lessons" value={formatCount(t.lessons)} note={`${decimal(t.hours)} hours · ${t.classes} classes`} />
      <Kpi label="Cover" value={formatCount(t.cover)} note="Lessons taught for someone else" />
      <Kpi label="Not started" value={formatCount(t.missedStarts)} note="Planned for them, nobody started" />
      <Kpi label="Swimmers taught" value={formatCount(t.swimmers)} />
      <Kpi label="Skills ticked" value={formatCount(t.ticks)} note={t.ticksPerLesson !== null ? `${decimal(t.ticksPerLesson)} a lesson` : undefined} />
      <Kpi label="Level passes" value={formatCount(t.passes)} />
    </KpiStrip>
    </Section>
    <Section id="detail" eyebrow="In detail" title="Against the school, week by week" intro="Each figure beside the school's, their classes and the swimmers who left after their lessons.">
    <Panel id="compare" title="Against the school" sub="Each figure beside the school's for the same period.">
      <ul className="ins-compare">
        <Compare label="Attendance" mine={t.attendance} school={school.attendance} />
        <Compare label="Started on time" mine={t.onTime} school={school.onTime} />
        <Compare label="Registers complete" mine={t.registers} school={school.registers} />
        <Compare label="Swimmers passing a level" mine={t.passRate} school={school.passRate} />
        <Compare label="Skills ticked a lesson" mine={t.ticksPerLesson} school={school.ticksPerLesson} format={decimal} />
        <Compare label="Swimmers who left after" mine={t.leaverRate} school={school.leaverRate} lowerBetter />
      </ul>
    </Panel>
    <div className="ins-grid ins-even">
      <Panel id="weekly" title="Lessons week by week">
        <TrendChart label="Lessons taught each week" points={byWeek.map(w => ({ x: w.week, y: w.lessons, label: `Week of ${formatDayMonth(w.week)}` }))} />
      </Panel>
      <Panel id="weekly-attendance" title="Attendance week by week" sub="In this teacher's lessons. Weeks with no lessons are left out.">
        <TrendChart label="Attendance each week" format={n => `${Math.round(n)}%`} points={byWeek.filter(w => w.attendance !== null).map(w => ({ x: w.week, y: w.attendance!, label: `Week of ${formatDayMonth(w.week)}` }))} />
      </Panel>
    </div>
    <Panel id="classes" title="Classes taught">
      {classes.length ? <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow><TableHead scope="col">Class</TableHead><TableHead scope="col" className="text-right">Lessons</TableHead><TableHead scope="col" className="text-right">Attendance</TableHead><TableHead scope="col" className="text-right">Registers</TableHead><TableHead scope="col">Last taught</TableHead></TableRow></TableHeader>
        <TableBody>{classes.map(c => <TableRow key={c.courseId}>
          <TableHead scope="row" className="whitespace-normal"><Link href={reportHref(data, `/analytics/classes/${c.courseId}`)} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline">{c.name}{c.slot ? ` · ${formatSlotShort(c.slot)}` : ""}</Link>{data.allSites ? <span className="ins-muted block">{c.siteName}</span> : null}</TableHead>
          <TableCell className="ins-num">{c.lessons}{c.cover ? <span className="ins-muted block">{c.cover} as cover</span> : null}</TableCell>
          <TableCell className="ins-num"><Meter value={c.attendance} /></TableCell>
          <TableCell className="ins-num"><Meter value={c.registers} /></TableCell>
          <TableCell>{formatShortDay(c.lastTaught)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <EmptyState compact title="No lessons started in this period" />}
    </Panel>
    <div className="ins-grid ins-even">
      <Panel id="leavers" title="Swimmers who left after their lessons" sub={`${t.leavers} in the period.`}>
        {t.leaverReasons.length ? <Bars label="Reasons" rows={t.leaverReasons.map(r => ({ key: r.key, label: r.label, value: r.count, tone: r.key === "teaching" ? "warn" as const : undefined }))} /> : null}
        {leavers.length ? <ul className="pc-rows">{leavers.map(l => <li key={`${l.studentId}-${l.date}`} className="pc-row"><div className="pc-row-body">
          <p className="pc-row-title">{data.canOpenSwimmers ? <Link href={`/students/${l.studentId}`} className="text-ui-primary hover:underline">{l.name}</Link> : l.name}</p>
          <p className="pc-row-hint">{formatDate(parseDateOnly(l.date))} · {l.reason} · {l.className} · came to {l.attended} of last {l.marked} · with us {weeks(l.weeks).toLowerCase()}</p>
        </div></li>)}</ul> : <p className="ins-sub">Nobody left after this teacher&apos;s lessons.</p>}
      </Panel>
      <Panel id="starts" title="Late and missed starts" sub="Started more than 5 minutes late, or not started at all.">
        {late.length || missed.length ? <ul className="pc-rows">
          {missed.map(m => <li key={`m-${m.courseId}-${m.date}`} className="pc-row"><div className="pc-row-body"><p className="pc-row-title">{m.className} · {formatShortDay(m.date)} {formatTime(m.startMinutes)}</p><p className="pc-row-hint">{m.marked ? `Not started · ${m.marked} marked` : "Not started · no register"}</p></div><div className="pc-row-trail"><Flag tone="bad">Not started</Flag></div></li>)}
          {late.map(l => <li key={`l-${l.courseId}-${l.date}`} className="pc-row"><div className="pc-row-body"><p className="pc-row-title">{l.className} · {formatShortDay(l.date)} {formatTime(l.startMinutes)}</p></div><div className="pc-row-trail"><Flag tone="warn">{l.minutes} min late</Flag></div></li>)}
        </ul> : <p className="ins-sub">Every lesson was started on time.</p>}
      </Panel>
    </div>
    </Section>
  </ReportShell>;
}
