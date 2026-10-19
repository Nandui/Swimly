import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatShortDay, formatTime, parseDateOnly, formatDate, plural } from "@/lib/format";
import { classTimes, formatSlot } from "@/modules/activities/shared/courses/constants";
import { leaveReasonLabel } from "@/modules/activities/shared/enrolment/leave-reasons";
import type { ClassInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { Flag, Kpi, KpiStrip, Meter, Panel, percent, reportHref, ReportShell, Section, weeks } from "@/modules/activities/features/analytics/components/insights/kit";

const MARK_LABEL = { PRESENT: "Present", LATE: "Late", ABSENT: "Absent" } as const;

export function ClassDetailReport({ data }: { data: ClassInsights }) {
  const c = data.course!;
  const back = { href: `${reportHref(data, "/analytics/classes")}`, label: "Classes" };
  return <ReportShell ctx={data} page="classes" path={`/analytics/classes/${c.id}`} back={back} title={`${c.name} · ${formatSlot(c.slot)}`} actions={data.canOpenClasses ? <Button asChild variant="outline"><Link href={`/courses/${c.id}`}>Open the class</Link></Button> : null}
    description={[c.programmeName, c.levelName !== c.name ? c.levelName : null, c.siteName, c.location].filter(Boolean).join(" · ")} footnotes={[
      "Attendance and lessons are for the period. Weeks at level count from the first place at this level, through moves between classes.",
      "Taught by is whoever started the lesson on the pool deck. Planned is who the rota or the class had down to teach it.",
    ]}>
    <Section id="glance" title="At a glance">
    <KpiStrip label="This class at a glance">
      <Kpi label="Swimmers" value={formatCount(c.enrolled)} note={c.capacity !== null ? `${percent(c.capacity ? c.enrolled / c.capacity * 100 : null)} of ${c.capacity} places` : "No limit"} />
      <Kpi label="Waiting" value={formatCount(c.waiting.length)} note={c.waiting[0] ? `Longest ${weeks(c.waiting[0].weeks)}` : "Nobody waiting"} />
      <Kpi label="Attendance" value={percent(c.attendance)} note={`${plural(c.lessonsHeld, "lesson")} held · ${c.cancelled} cancelled`} />
      <Kpi label="Registers complete" value={percent(c.registers)} note="Finished lessons with every swimmer marked" />
      <Kpi label="Left" value={formatCount(c.leavers.length)} note="Left the swim school from this class" />
    </KpiStrip>
    </Section>
    <Section id="detail" title="In detail" intro="Who is in the class, who is waiting, who left and every lesson with who taught it.">
    <Panel id="roster" title="Swimmers now" sub="Each swimmer's attendance in this class, their last lessons (newest first) and their skills at this level.">
      {c.roster.length ? <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Swimmer</TableHead>
          <TableHead scope="col" className="text-right">At this level</TableHead>
          <TableHead scope="col" className="text-right">Attendance</TableHead>
          <TableHead scope="col">Last lessons</TableHead>
          <TableHead scope="col" className="text-right">Skills</TableHead>
        </TableRow></TableHeader>
        <TableBody>{c.roster.map(s => <TableRow key={s.studentId}>
          <TableHead scope="row" className="whitespace-normal">
            {data.canOpenSwimmers ? <Link href={`/students/${s.studentId}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{s.name}</Link> : <span className="font-semibold">{s.name}</span>}
            <div className="ins-flags">
              {s.risk.map(r => <Flag key={r} tone="warn">{r}</Flag>)}
              {s.leavingOn ? <Flag tone="bad">Leaving {formatDate(parseDateOnly(s.leavingOn))}{s.leaveReason ? `: ${leaveReasonLabel(s.leaveReason)}` : ""}</Flag> : null}
              {s.weeksAtLevel > 26 ? <Flag tone="info">Over 6 months at this level</Flag> : null}
            </div>
          </TableHead>
          <TableCell className="ins-num">{weeks(s.weeksAtLevel)}<span className="ins-muted block">{weeks(s.weeksInClass)} in this class</span></TableCell>
          <TableCell className="ins-num"><Meter value={s.attendance} tone={s.attendance !== null && s.attendance < 60 ? "warn" : undefined} /><span className="ins-muted block">{plural(s.marked, "mark")}</span></TableCell>
          <TableCell><span className="ins-marks" role="img" aria-label={s.recent.length ? s.recent.map(m => `${formatShortDay(m.date)} ${MARK_LABEL[m.status]}`).join(", ") : "No marks yet"}>{s.recent.map(m => <span key={m.date} className="ins-mark" data-status={m.status} title={`${formatShortDay(m.date)}: ${MARK_LABEL[m.status]}`} />)}</span></TableCell>
          <TableCell className="ins-num">{s.skills ? <><Meter value={s.skills.achieved / s.skills.total * 100} /><span className="ins-muted block">{s.skills.achieved} of {s.skills.total}</span></> : <span className="ins-muted">—</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <EmptyState compact title="Nobody is in this class now" />}
    </Panel>
      <Panel span={6} id="waiting" title="Waiting list" sub="Longest wait first.">
        {c.waiting.length ? <ul className="pc-rows">{c.waiting.map(w => <li key={w.studentId} className="pc-row">
          <div className="pc-row-body"><p className="pc-row-title">{data.canOpenSwimmers ? <Link href={`/students/${w.studentId}`} className="text-ui-primary hover:underline">{w.name}</Link> : w.name}</p><p className="pc-row-hint">Since {formatDate(parseDateOnly(w.since))} · {weeks(w.weeks)}</p></div>
        </li>)}</ul> : <p className="ins-sub">Nobody is waiting.</p>}
      </Panel>
      <Panel span={6} id="leavers" title="Left from this class" sub="Swimmers whose last place was this class.">
        {c.leavers.length ? <ul className="pc-rows">{c.leavers.map(l => <li key={`${l.studentId}-${l.date}`} className="pc-row">
          <div className="pc-row-body"><p className="pc-row-title">{l.name}</p><p className="pc-row-hint">{formatDate(parseDateOnly(l.date))} · {l.reason} · with us {weeks(l.weeks).toLowerCase()}</p></div>
        </li>)}</ul> : <p className="ins-sub">Nobody left from this class in the period.</p>}
      </Panel>
    <Panel id="lessons" title="Every lesson" sub={`Newest first. ${classTimes(c.slot)}.`}>
      <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Date</TableHead>
          <TableHead scope="col">Taught by</TableHead>
          <TableHead scope="col" className="text-right">Started</TableHead>
          <TableHead scope="col" className="text-right">Came</TableHead>
          <TableHead scope="col">Register</TableHead>
        </TableRow></TableHeader>
        <TableBody>{c.lessons.map(l => <TableRow key={l.date}>
          <TableHead scope="row">{formatShortDay(l.date)}</TableHead>
          <TableCell className="whitespace-normal">{l.cancelled ? <Flag>Cancelled{l.cancelReason ? `: ${l.cancelReason}` : ""}</Flag> : l.started ? <>{l.teacher?.name}{l.cover ? <span className="ins-muted block">Cover for {l.planned?.name}</span> : null}</> : l.finished ? <><Flag tone="bad">Not started</Flag><span className="ins-muted block">Planned: {l.planned?.name ?? "nobody"}</span></> : <span className="ins-muted">Later today · {l.planned?.name ?? "nobody planned"}</span>}</TableCell>
          <TableCell className="ins-num">{l.started && l.startOffset !== null ? l.startOffset <= 5 ? <span>{l.startOffset <= 0 ? "On time" : `${l.startOffset} min`}</span> : <Flag tone="warn">{l.startOffset} min late</Flag> : <span className="ins-muted">—</span>}</TableCell>
          <TableCell className="ins-num">{l.cancelled ? "—" : `${l.came} of ${l.expected}`}</TableCell>
          <TableCell>{l.registerComplete === null ? <span className="ins-muted">—</span> : l.registerComplete ? <Flag tone="good">Complete</Flag> : <Flag tone="bad">{l.marked} of {l.expected} marked</Flag>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
      {c.lessons.length === 0 ? <EmptyState compact title="No lessons in this period" /> : null}
      {c.teachers.length ? <p className="ins-sub">Taught this period by {c.teachers.map(t => `${t.key} (${t.count})`).join(", ")}. Starts at {formatTime(c.slot.startMinutes)}.</p> : null}
    </Panel>
    </Section>
  </ReportShell>;
}
