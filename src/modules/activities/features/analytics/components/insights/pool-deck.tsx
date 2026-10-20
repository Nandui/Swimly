import { ClipboardList, GraduationCap } from "lucide-react";
import { formatCount, formatDateRange, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { PoolDeckInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { AttendanceHeat } from "@/modules/activities/features/analytics/components/insights/heat-maps";
import { TeacherTable } from "@/modules/activities/features/analytics/components/insights/teacher-table";
import { AreaChart, CompareColumns } from "@/modules/activities/features/analytics/components/insights/charts";
import { ChartHead, CompareList, MiniList, Sentence, SplitBar, type CompareRow } from "@/modules/activities/features/analytics/components/insights/blocks";
import { PillSwitch, ShowTable, TileSwitch } from "@/modules/activities/features/analytics/components/insights/switches";
import { before, moved, weekOf } from "@/modules/activities/features/analytics/components/insights/words";
import { asOf, Attention, Bars, decimal, DrillLinks, filterQuery, Panel, PanelLink, percent, ReportShell, reportHref, Section } from "@/modules/activities/features/analytics/components/insights/kit";

/** Ten points worse than the school reads as a word worth having, as on the teacher table. */
const GAP = 10;

const mean = (values: number[]) => values.length ? values.reduce((s, x) => s + x, 0) / values.length : null;

/** The pool deck dashboard (approved mockup, 20 October 2026), for the supervisor who manages the
 *  teachers: what to sort out, how lessons are delivered as tiles that each open a chart, every teacher
 *  compared on one measure at a time, and how swimmers progress. */
export function PoolDeckReport({ data }: { data: PoolDeckInsights }) {
  const o = data.overview;
  const t = data.teachers;
  const school = t.school;
  const p = data.progression;
  const r = data.registers;
  const progressionHref = reportHref(data, "/analytics/progression");
  const query = filterQuery(data);
  const was = before(data.period);
  const trend = o.trend;
  const worse = (value: number | null, against: number | null) => value !== null && against !== null && value < against - GAP;
  const flagged = t.teachers.filter(x => worse(x.attendance, school.attendance) || worse(x.onTime, school.onTime) || worse(x.registers, school.registers)
    || (x.leaverRate !== null && school.leaverRate !== null && x.leaverRate > school.leaverRate + GAP));
  const timed = p.levels.filter(l => l.medianWeeks !== null);
  const groups = new Set(p.levels.map(l => l.programmeName)).size;
  const ticks = t.teachers.reduce((s, x) => s + x.ticks, 0);
  const actions = [
    { key: "registers", count: r.missing + r.partial, title: "Registers not done this week", hint: `${formatCount(r.missing)} not taken, ${formatCount(r.partial)} partly recorded.`, href: "/analytics/instructors", tone: "bad" as const },
    { key: "starts", count: t.notStarted, title: "Lessons with no start record", hint: "Finished lessons with swimmers that nobody started on the pool deck.", href: "#teachers", tone: "bad" as const },
    { key: "teachers", count: flagged.length, title: "Teachers to have a word with", hint: flagged.slice(0, 3).map(x => x.name).join(", ") || "Every teacher is close to the school's figures.", href: "#teachers", tone: "warn" as const },
    { key: "stuck", count: o.attention.stuck, title: "Swimmers at one level over 6 months", hint: "May need a different class or a word with the teacher.", href: progressionHref, tone: "warn" as const },
  ];
  const open = actions.filter(a => a.count).length;

  const compare = (pick: (w: typeof trend[number]["before"]) => number | null) => ({ label: `Same week, ${was}`, values: trend.map(w => pick(w.before)) });
  const line = (pick: (w: typeof trend[number]["before"]) => number | null) => trend.filter(w => pick(w) !== null).map(w => ({ x: w.week, tick: formatDayMonth(w.week), y: pick(w)!, title: weekOf(w.week) }));
  const tiles = [
    { key: "attendance", label: "Attendance", value: percent(o.attendance.current), change: moved(o.attendance.current, o.attendance.previous, { better: "up", pts: true, against: was }), note: `${plural(o.lessons.held, "lesson")} held, ${formatCount(o.lessons.cancelled)} cancelled` },
    { key: "onTime", label: "Started on time", value: percent(school.onTime), note: "Within 5 minutes of the start" },
    { key: "registers", label: "Registers complete", value: percent(o.registers.current), change: moved(o.registers.current, o.registers.previous, { better: "up", pts: true, against: was }), note: "Every swimmer marked" },
    { key: "same", label: "Same teacher each week", value: percent(data.continuity.school), note: "Taught by the class's usual teacher", href: "#continuity" },
    { key: "ticks", label: "Skills ticked", value: formatCount(ticks), note: `${school.ticksPerLesson !== null ? `${decimal(school.ticksPerLesson)} a lesson` : "None"} across ${plural(t.teachers.length, "teacher")}` },
    { key: "passes", label: "Level passes", value: formatCount(o.passes.current ?? 0), change: moved(o.passes.current, o.passes.previous, { better: "up", against: was }), note: "Levels completed" },
  ];
  const panels = {
    attendance: <>
      <ChartHead title="Attendance week by week">{`${percent(o.attendance.current)} of swimmers came to their lessons, marked present or late. The dashed line is the same weeks of ${was}.`}</ChartHead>
      <AreaChart label="Attendance week by week" kind="percent" unit="attendance" height={240} compare={compare(w => w.attendance)} points={line(w => w.attendance)} />
    </>,
    onTime: <>
      <ChartHead title="Lessons started on time, week by week">{`${percent(school.onTime)} of lessons were started on the pool deck within 5 minutes of their start time.`}</ChartHead>
      <AreaChart label="Lessons started on time week by week" kind="percent" unit="on time" height={240} compare={compare(w => w.onTime)} points={line(w => w.onTime)} />
    </>,
    registers: <>
      <ChartHead title="Registers complete, week by week">{`${percent(o.registers.current)} of finished lessons had every swimmer marked present or absent.`}</ChartHead>
      <AreaChart label="Registers complete week by week" kind="percent" unit="complete" height={240} compare={compare(w => w.registers)} points={line(w => w.registers)} />
    </>,
    ticks: <>
      <ChartHead title="Skills ticked each week">{`${plural(ticks, "skill was", "skills were")} ticked off, ${school.ticksPerLesson !== null ? `${decimal(school.ticksPerLesson)} a lesson` : "none a lesson"}.`}</ChartHead>
      <CompareColumns label="Skills ticked each week" unit="skills ticked" previousLabel={`Same week, ${was}`} rows={trend.map(w => ({ key: w.week, tick: formatDayMonth(w.week), title: weekOf(w.week), value: w.ticks, previous: w.before.ticks }))} />
    </>,
    passes: <>
      <ChartHead title="Level passes each week">{`${plural(o.passes.current ?? 0, "swimmer")} passed a level${o.passes.previous !== null ? `, against ${formatCount(o.passes.previous)} in ${was}` : ""}.`}</ChartHead>
      <CompareColumns label="Level passes each week" unit="passes" previousLabel={`Same week, ${was}`} rows={trend.map(w => ({ key: w.week, tick: formatDayMonth(w.week), title: weekOf(w.week), value: w.passes, previous: w.before.passes }))} />
    </>,
  };

  // Every teacher, one measure at a time.
  const teacher = (x: typeof t.teachers[number]) => ({ key: x.key, name: x.name, sub: `${plural(x.classes, "class", "classes")}${x.cover ? `, ${x.cover} cover` : ""}`, href: `/analytics/teachers/${encodeURIComponent(x.key)}${query}` });
  const taught = t.teachers.filter(x => x.lessons > 0);
  const avgLessons = mean(taught.map(x => x.lessons)), avgPasses = mean(taught.map(x => x.passes));
  const below = (v: number | null, s: number | null, what: string) => worse(v, s) ? `${Math.round(s! - v!)} points below the school. ${what}` : null;
  const measures: { key: string; label: string; help: string; average: number | null; averageText: string; max?: number; rows: CompareRow[] }[] = [
    { key: "attendance", label: "Attendance", help: "How many booked swimmers came to their lessons.", average: school.attendance, averageText: percent(school.attendance), max: 100,
      rows: taught.filter(x => x.attendance !== null).map(x => ({ ...teacher(x), value: x.attendance, text: percent(x.attendance), note: below(x.attendance, school.attendance, "Worth looking at which classes.") })) },
    { key: "lessons", label: "Lessons", help: "Lessons each teacher started, including cover. Part-time teachers will teach fewer.", average: avgLessons, averageText: decimal(avgLessons),
      rows: t.teachers.map(x => ({ ...teacher(x), value: x.lessons, text: formatCount(x.lessons), note: x.missedStarts ? `${plural(x.missedStarts, "planned lesson")} finished with no start record.` : null })) },
    { key: "onTime", label: "On time", help: "Lessons started within 5 minutes of the timetable.", average: school.onTime, averageText: percent(school.onTime), max: 100,
      rows: taught.filter(x => x.onTime !== null).map(x => ({ ...teacher(x), value: x.onTime, text: percent(x.onTime), note: below(x.onTime, school.onTime, x.averageLate !== null ? `Late starts are about ${Math.round(x.averageLate)} minutes late.` : "Lessons start late more often.") })) },
    { key: "registers", label: "Registers", help: "Lessons where every swimmer was marked present or absent.", average: school.registers, averageText: percent(school.registers), max: 100,
      rows: taught.filter(x => x.registers !== null).map(x => ({ ...teacher(x), value: x.registers, text: percent(x.registers), note: below(x.registers, school.registers, "Registers are often left part done.") })) },
    { key: "ticks", label: "Skills a lesson", help: "Skills ticked off for each lesson taught.", average: school.ticksPerLesson, averageText: decimal(school.ticksPerLesson),
      rows: taught.map(x => ({ ...teacher(x), value: x.ticksPerLesson, text: decimal(x.ticksPerLesson), note: x.ticksPerLesson !== null && school.ticksPerLesson !== null && x.ticksPerLesson < school.ticksPerLesson * 0.75 ? `${decimal(school.ticksPerLesson - x.ticksPerLesson)} fewer skills ticked a lesson than the school.` : null })) },
    { key: "passes", label: "Passes", help: "Swimmers who passed their level with this teacher.", average: avgPasses, averageText: decimal(avgPasses),
      rows: taught.map(x => ({ ...teacher(x), value: x.passes, text: formatCount(x.passes) })) },
    { key: "left", label: "Left after", help: "Of the swimmers they taught, how many left the swim school after a lesson with them. Lower is better.", average: school.leaverRate, averageText: percent(school.leaverRate),
      rows: taught.filter(x => x.leaverRate !== null).map(x => ({ ...teacher(x), value: x.leaverRate, text: percent(x.leaverRate), note: x.leaverRate! > (school.leaverRate ?? 100) + GAP ? `${Math.round(x.leaverRate! - school.leaverRate!)} points above the school: ${plural(x.leavers, "swimmer")} left. Their page lists why.` : null })) },
  ];

  return <ReportShell ctx={data} page="pool-deck" path="/analytics/pool-deck" title="Pool deck" description="How lessons are going, and how each teacher is getting on." footnotes={[
    "A lesson belongs to whoever started it on the pool deck, so cover counts for the person who taught. Not started means a finished lesson with swimmers that nobody started; it counts against whoever was planned.",
    "On time means started no more than 5 minutes after the start time. Attendance is swimmers marked present or late out of everyone marked. Registers complete means every swimmer on the class was marked.",
    `Registers this week run Monday to Sunday (${formatDateRange(r.week.start, r.week.end)}) whatever the period above. Teachers are marked orange when more than 10 points worse than the school; small numbers move a lot.`,
    "Weeks to pass runs from a swimmer's first place at a level to the day it was completed; the middle value is shown.",
  ]}>
    <Panel id="act" title="Worth a look first" sub={open ? `${plural(open, "thing")} to sort out.` : "Nothing to sort out right now."}>
      <Attention columns items={actions} />
    </Panel>

    <Section id="delivery" title="How lessons are going" intro="Pick a figure to see it week by week.">
      <Panel id="trend" title="The pool deck at a glance" className="ins-panel-flush">
        <TileSwitch label="The pool deck at a glance" tiles={tiles} panels={panels} />
      </Panel>
      <Panel id="registers" span={5} title="Registers this week" sub={`${formatDateRange(r.week.start, r.week.end)} at ${data.siteName}. Finished classes with swimmers.`} action={<PanelLink href="/analytics/instructors">Registers</PanelLink>}
        figure={<><span className="ins-hero-value">{formatCount(r.saved)}</span><span className="ins-muted">of {plural(r.due, "class", "classes")} saved</span></>}>
        <SplitBar label="This week's registers" parts={[
          { key: "saved", label: "saved", value: r.saved, tone: "a" },
          { key: "partial", label: "partly recorded", value: r.partial, tone: "warn" },
          { key: "missing", label: "not taken", value: r.missing, tone: "b" },
        ]} />
      </Panel>
      <Panel id="slots" span={7} title="Attendance by time slot" sub="By day and start time, across the lessons held. Lighter slots lose more swimmers to absence.">
        <AttendanceHeat slots={data.slots} />
      </Panel>
    </Section>

    <Section id="teachers-section" title="The teachers" intro="Pick one thing to compare. Every teacher is on the same scale, and a bar turns orange when it is worth a word. Cover counts for whoever taught. Open a teacher for everything about them.">
      <Panel id="teachers" title="Each teacher" sub={t.notStarted ? `${plural(t.notStarted, "finished lesson")} had no start record, so ${t.notStarted === 1 ? "it is" : "they are"} counted for whoever was planned.` : undefined}>
        <PillSwitch label="Compare by" options={measures.map(m => ({ key: m.key, label: m.label }))} panels={Object.fromEntries(measures.map(m => [m.key, <CompareList key={m.key} label={`The teachers by ${m.label.toLowerCase()}`} word="school" help={m.help} average={m.average} averageText={m.averageText} max={m.max} rows={m.rows} />]))} />
        <ShowTable label="Show every teacher as a table">
          <TeacherTable teachers={t.teachers} school={school} query={query} />
        </ShowTable>
      </Panel>
    </Section>

    <Section id="consistency" title="Consistency" intro="Whether classes keep their teacher, and the lessons that did not happen.">
      <Panel span={7} id="continuity" title="Same teacher each week" sub={`${percent(data.continuity.school)} of lessons were taught by the class's usual teacher. Classes with the most changes first.`}>
        <MiniList label="Classes with the most teacher changes" empty="No lessons started in this period." rows={data.continuity.classes.slice(0, 6).map(k => ({
          key: k.courseId,
          title: k.course ? `${k.course.name} · ${formatSlotShort(k.course.slot)}` : "Class removed",
          href: k.course ? reportHref(data, `/analytics/classes/${k.courseId}`) : undefined,
          hint: `${data.allSites && k.course ? `${k.course.siteName}, ` : ""}${plural(k.teachers, "teacher")} over ${plural(k.lessons, "lesson")}, usually ${k.main}`,
          value: percent(k.share), tone: k.share < 75 ? "warn" as const : undefined,
        }))} />
      </Panel>
      <Panel span={5} id="cancelled" title="Cancelled lessons" sub={`${plural(data.cancellations.lessons, "lesson")} cancelled (${percent(data.cancellations.share, 1)} of those timetabled), affecting ${plural(data.cancellations.swimmers, "swimmer place", "swimmer places")}. ${formatCount(data.cancellations.previous)} in ${was}.`}>
        {data.cancellations.reasons.length ? <Bars label="Cancelled lessons by reason" rows={data.cancellations.reasons.map(c => ({ key: c.key, label: c.key, value: c.count }))} /> : <p className="ins-sub">No lessons were cancelled.</p>}
      </Panel>
    </Section>

    <Section id="progress" title="Progress" intro="How quickly swimmers pass each level and what holds them back.">
      <Panel span={6} id="pass-time" title="Weeks to pass each level" sub="The middle swimmer's time, for levels passed in the period. Orange is over six months." action={<PanelLink href={progressionHref}>Level by level</PanelLink>}>
        {timed.length ? <Bars label="Weeks to pass by level" format={n => `${Math.round(n)} wk`} rows={timed.map(l => ({ key: l.levelId, label: `${l.name}${groups > 1 ? ` · ${l.programmeName}` : ""}`, value: l.medianWeeks!, tone: l.medianWeeks! > 26 ? "warn" as const : undefined }))} /> : <p className="ins-sub">No level passes in this period.</p>}
      </Panel>
      <Panel span={6} id="hardest" title="Skills holding swimmers back" sub={`The skill the fewest swimmers at each level have. ${plural(p.stuck, "swimmer")} here ${asOf(data.period)} have been at their level over 6 months.`}>
        {p.levels.some(l => l.hardest) ? <>
          <Bars label="Hardest skill by level" format={n => `${Math.round(n)}%`} rows={p.levels.filter(l => l.hardest).slice(0, 8).map(l => ({ key: l.levelId, label: `${l.hardest!.name} · ${l.name}`, value: l.hardest!.achieved ?? 0, note: "of swimmers at the level have it" }))} />
          <Sentence>The figure is how many swimmers at that level have the skill so far.</Sentence>
        </> : <p className="ins-sub">Not enough swimmers at any level yet.</p>}
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
