import Link from "next/link";
import { ClipboardList, GraduationCap } from "lucide-react";
import { formatCount, formatDateRange, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { PoolDeckInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { AttendanceHeat } from "@/modules/activities/features/analytics/components/insights/heat-maps";
import { TeacherTable } from "@/modules/activities/features/analytics/components/insights/teacher-table";
import { asOf, Attention, Bars, Delta, DrillLinks, filterQuery, Kpi, KpiStrip, Meter, Panel, PanelLink, percent, ReportShell, reportHref, Section, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";

/** Ten points worse than the school reads as a word worth having, as on the teacher table. */
const GAP = 10;

/** The pool deck dashboard: for the supervisor who manages the teachers. How lessons are delivered
 *  (attendance, registers, punctual starts, the same teacher each week, cancellations), how swimmers
 *  progress (skills, passes, time at a level), and each teacher against the school. */
export function PoolDeckReport({ data }: { data: PoolDeckInsights }) {
  const o = data.overview;
  const t = data.teachers;
  const school = t.school;
  const p = data.progression;
  const r = data.registers;
  const progressionHref = reportHref(data, "/analytics/progression");
  const week = (w: { week: string }) => `Week of ${formatDayMonth(w.week)}`;
  const worse = (value: number | null, against: number | null) => value !== null && against !== null && value < against - GAP;
  const flagged = t.teachers.filter(x => worse(x.attendance, school.attendance) || worse(x.onTime, school.onTime) || worse(x.registers, school.registers)
    || (x.leaverRate !== null && school.leaverRate !== null && x.leaverRate > school.leaverRate + GAP));
  const timed = p.levels.filter(l => l.medianWeeks !== null);
  const groups = new Set(p.levels.map(l => l.programmeName)).size;
  const ticks = t.teachers.reduce((s, x) => s + x.ticks, 0);
  const actions = [
    { key: "registers", count: r.missing + r.partial, title: "Registers not done this week", hint: `${formatCount(r.missing)} not taken · ${formatCount(r.partial)} partly recorded`, href: "/analytics/instructors", tone: "bad" as const },
    { key: "starts", count: t.notStarted, title: "Lessons with no start record", hint: "Finished lessons with swimmers that nobody started on the pool deck", href: "#teachers", tone: "bad" as const },
    { key: "teachers", count: flagged.length, title: "Teachers to have a word with", hint: flagged.slice(0, 3).map(x => x.name).join(" · ") || "Every teacher is close to the school's figures", href: "#teachers", tone: "warn" as const },
    { key: "stuck", count: o.attention.stuck, title: "Swimmers at one level over 6 months", hint: "May need a different class or a word with the teacher", href: progressionHref, tone: "warn" as const },
  ];
  return <ReportShell ctx={data} page="pool-deck" path="/analytics/pool-deck" title="Pool deck" footnotes={[
    "A lesson belongs to whoever started it on the pool deck, so cover counts for the person who taught. Not started means a finished lesson with swimmers that nobody started; it counts against whoever was planned.",
    "On time means started no more than 5 minutes after the start time. Attendance is swimmers marked present or late out of everyone marked. Registers complete means every swimmer on the class was marked.",
    `Registers this week run Monday to Sunday (${formatDateRange(r.week.start, r.week.end)}) whatever the period above. Figures in gold are more than 10 points worse than the school's; small numbers move a lot.`,
    "Weeks to pass runs from a swimmer's first place at a level to the day it was completed; the middle value is shown.",
  ]}>
    <KpiStrip label="The pool deck at a glance">
      <Kpi label="Attendance" value={percent(o.attendance.current)} spark={o.trend.map(w => w.attendance)} delta={<Delta change={o.attendance} better="up" unit="pts" label="against the period before" />} note={`${plural(o.lessons.held, "lesson")} held · ${formatCount(o.lessons.cancelled)} cancelled`} />
      <Kpi label="Started on time" value={percent(school.onTime)} meter={school.onTime} note="Within 5 minutes of the start" />
      <Kpi label="Registers complete" value={percent(o.registers.current)} delta={<Delta change={o.registers} better="up" unit="pts" label="against the period before" />} note="Every swimmer marked" href="/analytics/instructors" />
      <Kpi label="Same teacher each week" value={percent(data.continuity.school)} meter={data.continuity.school} note="Taught by the class's usual teacher" />
      <Kpi label="Skills ticked" value={formatCount(ticks)} note={`${school.ticksPerLesson !== null ? `${(Math.round(school.ticksPerLesson * 10) / 10).toString()} a lesson` : "None"} across ${plural(t.teachers.length, "teacher")}`} href={progressionHref} />
      <Kpi label="Level passes" value={formatCount(o.passes.current ?? 0)} spark={o.trend.map(w => w.passes)} delta={<Delta change={o.passes} better="up" label="against the period before" />} note="Levels completed" href={progressionHref} />
    </KpiStrip>

    <Section id="delivery" title="Service delivery" intro="Who came to their lessons, what to sort out this week, and which slots lose swimmers to absence.">
      <Panel id="attendance-trend" span={8} title="Attendance week by week" sub="The share of swimmers marked present or late."
        figure={<><span className="ins-hero-value">{percent(o.attendance.current)}</span><Delta change={o.attendance} better="up" unit="pts" label="against the period before" /><span className="ins-muted">against the period before</span></>}>
        <TrendChart label="Attendance week by week" kind="percent" unit="attendance" height={220} points={o.trend.filter(w => w.attendance !== null).map(w => ({ x: w.week, y: w.attendance!, label: week(w) }))} />
      </Panel>
      <Panel id="act" span={4} title="To sort out" sub={`${plural(actions.filter(a => a.count).length, "thing")} need a look.`}>
        <Attention items={actions} />
      </Panel>
      <Panel id="registers" span={5} title="Registers this week" sub={`${formatDateRange(r.week.start, r.week.end)} at ${data.siteName}. Finished classes with swimmers.`} action={<PanelLink href="/analytics/instructors">Registers</PanelLink>}
        figure={<><span className="ins-hero-value">{formatCount(r.saved)}</span><span className="ins-muted">of {plural(r.due, "class", "classes")} saved</span></>}>
        <Bars label="This week's registers" rows={[
          { key: "saved", label: "Attendance saved", value: r.saved },
          { key: "partial", label: "Partly recorded", value: r.partial, tone: "warn" as const },
          { key: "missing", label: "Not taken", value: r.missing, tone: "warn" as const },
        ]} />
      </Panel>
      <Panel id="slots" span={7} title="Attendance by time slot" sub="By day and start time, across the lessons held. Lighter slots lose more swimmers to absence.">
        <AttendanceHeat slots={data.slots} />
      </Panel>
      <Panel span={7} id="continuity" title="Same teacher each week" sub={`${percent(data.continuity.school)} of lessons were taught by the class's usual teacher. Classes with the most changes first.`}>
        {data.continuity.classes.length ? <ul className="pc-rows">{data.continuity.classes.slice(0, 6).map(k => <li key={k.courseId} className="pc-row"><div className="pc-row-body">
          <p className="pc-row-title">{k.course ? <Link href={reportHref(data, `/analytics/classes/${k.courseId}`)} className="text-ui-primary hover:underline">{k.course.name} · {formatSlotShort(k.course.slot)}</Link> : "Class removed"}</p>
          <p className="pc-row-hint">{data.allSites && k.course ? `${k.course.siteName} · ` : ""}{plural(k.teachers, "teacher")} over {plural(k.lessons, "lesson")} · usually {k.main}</p>
        </div><div className="pc-row-trail"><Meter value={k.share} tone={k.share < 75 ? "warn" : undefined} /></div></li>)}</ul> : <p className="ins-sub">No lessons started in this period.</p>}
      </Panel>
      <Panel span={5} id="cancelled" title="Cancelled lessons" sub={`${plural(data.cancellations.lessons, "lesson")} cancelled (${percent(data.cancellations.share, 1)} of those timetabled), affecting ${plural(data.cancellations.swimmers, "swimmer place", "swimmer places")}. ${formatCount(data.cancellations.previous)} in the period before.`}>
        {data.cancellations.reasons.length ? <Bars label="Cancelled lessons by reason" rows={data.cancellations.reasons.map(c => ({ key: c.key, label: c.key, value: c.count }))} /> : <p className="ins-sub">No lessons were cancelled.</p>}
      </Panel>
    </Section>

    <Section id="teachers-section" title="Teachers" intro="Each teacher against the school. Sort, search and open a teacher for their week by week figures, their classes and the swimmers who left after their lessons.">
      <KpiStrip label="Teaching across the school">
        <Kpi label="Lessons taught" value={formatCount(t.lessons - t.notStarted)} note={`${formatCount(t.teachers.length)} teachers`} />
        <Kpi label="Not started" value={formatCount(t.notStarted)} note="Finished lessons with no start record" />
        <Kpi label="Attendance" value={percent(school.attendance)} note="Across every lesson taught" />
        <Kpi label="Left after" value={percent(school.leaverRate)} note="Of swimmers taught, across the school" />
      </KpiStrip>
      <Panel id="teachers" title="Every teacher" sub="Gold figures are more than 10 points worse than the school's.">
        <TeacherTable teachers={t.teachers} school={school} query={filterQuery(data)} />
      </Panel>
    </Section>

    <Section id="progress" title="Progress" intro="How quickly swimmers pass each level and how assessments go.">
      <Panel span={6} id="pass-time" title="Weeks to pass each level" sub="The middle swimmer's time, for levels passed in the period." action={<PanelLink href={progressionHref}>Level by level</PanelLink>}>
        {timed.length ? <Bars label="Weeks to pass by level" format={n => `${Math.round(n)} wk`} rows={timed.map(l => ({ key: l.levelId, label: `${l.name}${groups > 1 ? ` · ${l.programmeName}` : ""}`, value: l.medianWeeks!, tone: l.medianWeeks! > 26 ? "warn" as const : undefined }))} /> : <p className="ins-sub">No level passes in this period.</p>}
      </Panel>
      <Panel span={6} id="hardest" title="Skills holding swimmers back" sub={`The skill the fewest swimmers at each level have. ${plural(p.stuck, "swimmer")} here ${asOf(data.period)} have been at their level over 6 months.`}>
        {p.levels.some(l => l.hardest) ? <Bars label="Hardest skill by level" format={n => `${Math.round(n)}%`} rows={p.levels.filter(l => l.hardest).slice(0, 8).map(l => ({ key: l.levelId, label: `${l.hardest!.name} · ${l.name}`, value: l.hardest!.achieved ?? 0, note: "of swimmers at the level have it" }))} /> : <p className="ins-sub">Not enough swimmers at any level yet.</p>}
      </Panel>
    </Section>

    <Section id="detail" title="Go deeper" intro="The lists behind these figures.">
      <DrillLinks label="Pool deck detail" links={[
        { href: "/analytics/instructors", title: "Registers", hint: "This week's classes by instructor: saved, partly recorded and not taken", icon: ClipboardList, count: formatCount(r.due) },
        { href: progressionHref, title: "Level by level", hint: "Swimmers, passes, skills done and time at each level, and the assessments funnel", icon: GraduationCap, count: formatCount(p.passes) },
      ]} />
    </Section>
  </ReportShell>;
}
