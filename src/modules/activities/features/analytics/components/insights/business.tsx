import { Copy, LayoutGrid, Users } from "lucide-react";
import { formatCount, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { BusinessInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { TimetableHeat } from "@/modules/activities/features/analytics/components/insights/heat-maps";
import { AreaChart, ColumnChart, CompareColumns } from "@/modules/activities/features/analytics/components/insights/charts";
import { ChartHead, LevelPlaces, MiniList, Sentence, SplitBar } from "@/modules/activities/features/analytics/components/insights/blocks";
import { PillSwitch, TileSwitch } from "@/modules/activities/features/analytics/components/insights/switches";
import { before, busiest, moved, weekOf } from "@/modules/activities/features/analytics/components/insights/words";
import { asOf, Attention, Bars, DrillLinks, Panel, PanelLink, percent, ReportShell, reportHref, Section } from "@/modules/activities/features/analytics/components/insights/kit";

/** The business dashboard (approved mockup, 20 October 2026): what is worth a look first, how the swim
 *  school is growing as five tiles that each open one chart, where the timetable is full, places at
 *  each level, who left, and assessments, the next four weeks and ages. Every figure opens the list
 *  behind it. */
export function BusinessReport({ data }: { data: BusinessInsights }) {
  const o = data.overview;
  const a = data.assessments;
  const p = data.period;
  const swimmersHref = reportHref(data, "/analytics/swimmers");
  const classesHref = reportHref(data, "/analytics/classes");
  const now = asOf(p);
  const was = before(p);
  const trend = o.trend;
  const last = trend.at(-1);

  const decisions = [
    { key: "full", count: o.attention.fullCount, title: "Full classes with a waiting list", hint: o.attention.fullWithWaiting.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.waiting} waiting)`).join(" · ") || "Room in every class with a waiting list", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "quiet", count: o.attention.quietCount, title: "Classes under half full", hint: o.attention.quiet.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.enrolled} of ${c.capacity})`).join(" · ") || "Every class is at least half full", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "risk", count: o.attention.atRisk, title: "Swimmers who may leave", hint: "Missed three in a row, or came to under 60% of their last eight lessons", href: `${swimmersHref}#at-risk`, tone: "warn" as const },
    { key: "leaving", count: o.attention.leaving, title: "Leaving soon", hint: "A last lesson is booked in", href: `${swimmersHref}#leaving`, tone: "warn" as const },
  ];
  const open = decisions.filter(d => d.count).length;

  const grew = (o.swimmers.current ?? 0) - (o.swimmers.previous ?? 0);
  const waitingLevels = data.capacity.levels.filter(l => l.waiting > 0).sort((x, y) => y.waiting - x.waiting);
  const joinedWeek = busiest(trend, t => t.joined), leftWeek = busiest(trend, t => t.left);
  const tiles = [
    { key: "swimmers", label: "Swimmers", value: formatCount(o.swimmers.current ?? 0), change: moved(o.swimmers.current, o.swimmers.previous, { better: "up", against: "the start" }), note: `In ${plural(o.places, "class place")}` },
    { key: "joined", label: "Joined", value: formatCount(o.joined.current ?? 0), change: moved(o.joined.current, o.joined.previous, { better: "up", against: was }), note: `${formatCount(o.newSwimmers)} new to the swim school` },
    { key: "left", label: "Left", value: formatCount(o.left.current ?? 0), change: moved(o.left.current, o.left.previous, { better: "down", against: was }), note: `${percent(o.retention.rate)} of swimmers stayed` },
    { key: "fill", label: "Places filled", value: percent(o.fill.rate), change: moved(last?.fill ?? null, last?.before.fill ?? null, { better: "up", pts: true, against: was }), note: `${formatCount(o.fill.empty)} places free` },
    { key: "waiting", label: "Waiting for a place", value: formatCount(o.waiting.swimmers), note: `${plural(o.waiting.bookings, "waiting list booking")} today` },
  ];
  const compare = (pick: (t: typeof trend[number]["before"]) => number | null) => ({ label: `Same week, ${was}`, values: trend.map(t => pick(t.before)) });
  const columns = (pick: (t: typeof trend[number]["before"]) => number) => trend.map(t => ({ key: t.week, tick: formatDayMonth(t.week), title: weekOf(t.week), value: pick(t), previous: pick(t.before) }));
  const panels = {
    swimmers: <>
      <ChartHead title={`Swimmers ${now}`}>
        {grew === 0 ? `The swim school has ${formatCount(o.swimmers.current ?? 0)} swimmers, the same as at the start.` : `The swim school ${grew > 0 ? "grew" : "shrank"} by ${plural(Math.abs(grew), "swimmer")} since the start, to ${formatCount(o.swimmers.current ?? 0)}. The dashed line is the same weeks of ${was}.`}
      </ChartHead>
      <AreaChart label="Swimmers week by week" unit="swimmers" height={240} compare={compare(t => t.swimmers)} points={trend.map(t => ({ x: t.week, tick: formatDayMonth(t.week), y: t.swimmers, title: weekOf(t.week) }))} />
    </>,
    joined: <>
      <ChartHead title="Swimmers who joined each week">
        {`${plural(o.joined.current ?? 0, "swimmer")} joined${o.joined.previous !== null ? `, against ${formatCount(o.joined.previous)} in ${was}` : ""}.${joinedWeek ? ` The busiest was ${joinedWeek}.` : ""}`}
      </ChartHead>
      <CompareColumns label="Swimmers who joined each week" unit="joined" previousLabel={`Same week, ${was}`} rows={columns(t => t.joined)} />
    </>,
    left: <>
      <ChartHead title="Swimmers who left each week">
        {`${plural(o.left.current ?? 0, "swimmer")} left${o.left.previous !== null ? `, against ${formatCount(o.left.previous)} in ${was}` : ""}.${leftWeek ? ` The most left in ${leftWeek}.` : ""} Moving class or site is not leaving.`}
      </ChartHead>
      <CompareColumns label="Swimmers who left each week" unit="left" tone="b" previousLabel={`Same week, ${was}`} rows={columns(t => t.left)} />
    </>,
    fill: <>
      <ChartHead title="Places filled week by week">
        {`${percent(o.fill.rate)} of places are filled: ${formatCount(o.fill.enrolled)} of ${formatCount(o.fill.capacity)}, with ${formatCount(o.fill.empty)} free. Each week is measured against today's classes.`}
      </ChartHead>
      <AreaChart label="Places filled week by week" kind="percent" unit="filled" height={240} compare={compare(t => t.fill)} points={trend.filter(t => t.fill !== null).map(t => ({ x: t.week, tick: formatDayMonth(t.week), y: t.fill!, title: weekOf(t.week) }))} />
    </>,
    waiting: <>
      <ChartHead title="Who is waiting, by level">
        {o.waiting.swimmers ? `${plural(o.waiting.swimmers, "swimmer is", "swimmers are")} waiting for a place today${waitingLevels[0] ? `, most for ${waitingLevels[0].name}` : ""}. Turnfin keeps today's list, not how it looked before.` : "Nobody is waiting for a place today."}
      </ChartHead>
      {waitingLevels.length ? <Bars label="Waiting list by level" rows={waitingLevels.map(l => ({ key: l.levelId, label: `${l.name} · ${l.programmeName}`, value: l.waiting }))} /> : null}
    </>,
  };

  const leftBy = {
    reason: o.reasons.length ? <>
      <Bars share label="Leavers by reason" rows={o.reasons.map(r => ({ key: r.key, label: r.label, value: r.count, tone: r.key === "teaching" || r.key === "progress" ? "warn" as const : undefined }))} />
      {o.reasons.some(r => r.key === "none") ? <Sentence>Not recorded means they were unenrolled before Turnfin asked why (16 October 2026).</Sentence> : null}
    </> : <p className="ins-sub">Nobody left in this period.</p>,
    level: o.leftByLevel.length ? <Bars share label="Leavers by level" rows={o.leftByLevel.map(r => ({ key: r.key, label: r.label, value: r.count }))} /> : <p className="ins-sub">Nobody left in this period.</p>,
  };

  const conversionParts = [
    { key: "converted", label: "started a class", value: a.converted, tone: "a" as const },
    { key: "waiting", label: "given a level, no class yet", value: Math.max(0, a.placed - a.converted), tone: "muted" as const },
    { key: "unplaced", label: "assessed, no level", value: Math.max(0, a.attended - a.placed), tone: "muted" as const },
    { key: "noshow", label: "did not come", value: a.noShow, tone: "b" as const },
  ];

  return <ReportShell ctx={data} page="business" path="/analytics" title="Business" description="How the swim school is doing, and the decisions worth making." footnotes={[
    "Swimmers are counted once however many classes they hold. Waiting lists, future starts and archived classes are left out. Moving class or site is not leaving.",
    "Places filled counts classes with a limit; each week is measured against today's classes. Waiting lists and the next four weeks are always as of today.",
    "Booked to a place counts swimmers assessed in the period who started a class within 30 days.",
  ]}>
    <Panel id="decisions" title="Worth a look first" sub={open ? `${plural(open, "thing")} to decide on.` : "Nothing needs a decision right now."}>
      <Attention columns items={decisions} />
    </Panel>

    <Section id="growth" title="How we are growing" intro="Pick a figure to see it week by week.">
      <Panel id="trend" title="The swim school at a glance" className="ins-panel-flush">
        <TileSwitch label="The swim school at a glance" tiles={tiles} panels={panels} />
      </Panel>
    </Section>

    <Section id="capacity" title="Where there is room" intro={`Where to add or merge classes: the timetable ${asOf(p, "today")}, each level and the coming weeks.`}>
      <Panel id="timetable" span={8} title="When classes are full" sub="Places filled by day and start time. An orange dot means someone is waiting for a class in that slot." action={<PanelLink href={`${classesHref}#classes`}>Every class</PanelLink>}>
        <TimetableHeat capacity={data.capacity} />
      </Panel>
      <Panel id="extremes" span={4} title="Full, and nearly empty">
        <h4 className="ins-mini-head">Full with a waiting list</h4>
        <MiniList label="Full classes with a waiting list" empty="Room in every class with a waiting list." rows={o.attention.fullWithWaiting.map(c => ({ key: c.id, title: c.name, hint: formatSlotShort(c), value: `${c.waiting} waiting`, tone: "warn" as const, href: data.canOpenClasses ? reportHref(data, `/analytics/classes/${c.id}`) : undefined }))} />
        <h4 className="ins-mini-head">Under half full</h4>
        <MiniList label="Classes under half full" empty="Every class is at least half full." rows={o.attention.quiet.map(c => ({ key: c.id, title: c.name, hint: formatSlotShort(c), value: `${c.enrolled} of ${c.capacity}`, href: data.canOpenClasses ? reportHref(data, `/analytics/classes/${c.id}`) : undefined }))} />
      </Panel>
      <Panel id="levels" span={7} title="Places at each level" sub="Where swimmers wait and where places sit empty.">
        <LevelPlaces rows={data.capacity.levels.map(l => ({ key: l.levelId, name: l.name, group: l.programmeName, filled: Math.max(0, l.capacity - l.empty), free: l.empty, waiting: l.waiting, classes: l.classes }))} />
      </Panel>
      <Panel id="reasons" span={5} title="Who left" sub={o.left.current ? `${plural(o.left.current, "swimmer")} left in this period.` : "Nobody left in this period."} action={<PanelLink href={`${swimmersHref}#leavers`}>Every leaver</PanelLink>}>
        <PillSwitch label="Show leavers by" options={[{ key: "reason", label: "Reason" }, { key: "level", label: "Level" }]} panels={leftBy} />
      </Panel>
    </Section>

    <Section id="demand" title="Demand and the weeks ahead" intro="Whether assessments turn into places, what is already booked, and the ages we teach.">
      <Panel id="conversion" span={4} title="Assessments to places" sub={`${formatCount(a.sessions)} assessment sessions in the period.`} figure={<><span className="ins-hero-value">{percent(a.conversion)}</span><span className="ins-muted">started a class</span></>}>
        <SplitBar label="What happened after an assessment" parts={conversionParts} />
        <Sentence>{a.daysToClass !== null ? `Their first lesson was usually ${plural(a.daysToClass, "day")} after the assessment.` : "No first lessons yet."}</Sentence>
      </Panel>
      <Panel id="forecast" span={4} title="The next four weeks" sub={`Places already booked from today. New joiners are not guessed. ${plural(data.forecast.waiting, "swimmer is", "swimmers are")} on a waiting list.`}>
        <ColumnChart label="Places filled in the coming weeks" kind="percent" height={150} rows={data.forecast.weeks.map((w, i) => ({ key: w.date, tick: i === 0 ? "Today" : formatDayMonth(w.date), value: w.fill ?? 0 }))} />
        <MiniList label="Places starting and ending" empty="" rows={data.forecast.weeks.slice(1).map(w => ({ key: w.date, title: `Week of ${formatDayMonth(w.date)}`, hint: `${formatCount(w.places)} places, ${formatCount(w.swimmers)} swimmers`, value: w.starting || w.ending ? [w.starting ? `${formatCount(w.starting)} starting` : "", w.ending ? `${formatCount(w.ending)} ending` : ""].filter(Boolean).join(", ") : "No change", tone: w.ending > w.starting ? "warn" as const : undefined }))} />
      </Panel>
      <Panel id="ages" span={4} title="Swimmers by age" sub={o.ages.unknown ? `${plural(o.ages.unknown, "swimmer")} with no date of birth left out.` : `Age ${p.current ? "today" : `on ${formatDayMonth(p.end)}`}.`}>
        <ColumnChart label="Swimmers by age" height={190} rows={o.ages.bands.map(b => ({ key: b.label, tick: b.label, short: b.label.replace(" to ", "–").replace(" and over", "+"), value: b.count }))} />
      </Panel>
    </Section>

    <Section id="detail" title="Go deeper" intro="The lists behind these figures.">
      <DrillLinks label="Business detail" links={[
        { href: classesHref, title: "Every class", hint: "Fill, waiting list and attendance for each class, then its swimmers and lessons", icon: LayoutGrid, count: formatCount(data.capacity.levels.reduce((s, l) => s + l.classes, 0)) },
        { href: swimmersHref, title: "Swimmers and leavers", hint: "Who may leave, who is leaving, every leaver and how long new swimmers stay", icon: Users, count: formatCount(o.swimmers.current ?? 0) },
        { href: "/analytics/multiple-places", title: "Multiple enrolments", hint: "Swimmers holding more than one place or waiting list booking", icon: Copy },
      ]} />
    </Section>
  </ReportShell>;
}
