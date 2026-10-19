import { Copy, LayoutGrid, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { BusinessInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { TimetableHeat } from "@/modules/activities/features/analytics/components/insights/heat-maps";
import { asOf, Attention, Bars, ColumnChart, Delta, DrillLinks, Kpi, KpiStrip, Meter, PairedColumns, Panel, PanelLink, percent, ReportShell, reportHref, Section, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";

/** The business dashboard: is the swim school growing, where is the timetable full or empty, who
 *  leaves and why, and is demand turning into places. Each figure opens the list behind it. */
export function BusinessReport({ data }: { data: BusinessInsights }) {
  const o = data.overview;
  const a = data.assessments;
  const swimmersHref = reportHref(data, "/analytics/swimmers");
  const classesHref = reportHref(data, "/analytics/classes");
  const now = asOf(data.period);
  const week = (t: { week: string }) => `Week of ${formatDayMonth(t.week)}`;
  const decisions = [
    { key: "full", count: o.attention.fullCount, title: "Full classes with a waiting list", hint: o.attention.fullWithWaiting.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.waiting} waiting)`).join(" · ") || "Room in every class with a waiting list", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "quiet", count: o.attention.quietCount, title: "Classes under half full", hint: o.attention.quiet.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.enrolled} of ${c.capacity})`).join(" · ") || "Every class is at least half full", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "risk", count: o.attention.atRisk, title: "Swimmers who may leave", hint: "Missed three in a row, or came to under 60% of their last eight lessons", href: `${swimmersHref}#at-risk`, tone: "warn" as const },
    { key: "leaving", count: o.attention.leaving, title: "Leaving soon", hint: "A last lesson is booked in", href: `${swimmersHref}#leaving`, tone: "warn" as const },
  ];
  return <ReportShell ctx={data} page="business" path="/analytics" title="Business" footnotes={[
    "Swimmers are counted once however many classes they hold. Waiting lists, future starts and archived classes are left out. Moving class or site is not leaving.",
    "Places filled counts classes with a limit. The small lines under figures show the weeks of the period. Waiting lists and the next four weeks are always as of today.",
    "Booked to a place counts swimmers assessed in the period who started a class within 30 days.",
  ]}>
    <KpiStrip label="The swim school at a glance">
      <Kpi label={`Swimmers ${now}`} value={formatCount(o.swimmers.current ?? 0)} spark={o.trend.map(t => t.swimmers)} delta={<Delta change={o.swimmers} better="up" label="since the start of the period" />} note={`In ${plural(o.places, "class place")}`} href={swimmersHref} />
      <Kpi label="Places filled" value={percent(o.fill.rate)} meter={o.fill.rate} note={`${formatCount(o.fill.enrolled)} of ${formatCount(o.fill.capacity)} · ${formatCount(o.fill.empty)} free`} href={classesHref} />
      <Kpi label="Waiting list" value={formatCount(o.waiting.bookings)} note={`${plural(o.waiting.swimmers, "swimmer")} waiting today`} href={`${classesHref}#classes`} />
      <Kpi label="Joined" value={formatCount(o.joined.current ?? 0)} spark={o.trend.map(t => t.joined)} delta={<Delta change={o.joined} better="up" label="against the period before" />} note={`${formatCount(o.newSwimmers)} new to the swim school`} href={swimmersHref} />
      <Kpi label="Left" value={formatCount(o.left.current ?? 0)} spark={o.trend.map(t => t.left)} delta={<Delta change={o.left} better="down" label="against the period before" />} note="No place left at any site" href={`${swimmersHref}#leavers`} />
      <Kpi label="Stayed" value={percent(o.retention.rate)} meter={o.retention.rate} note={`${formatCount(o.retention.stayed)} of the ${formatCount(o.retention.start)} here at the start`} href={swimmersHref} />
    </KpiStrip>

    <Section id="growth" title="Growth" intro="Swimmers week by week, who joined and left, and why they left.">
      <Panel id="trend" span={8} title={`Swimmers ${now}`} sub="Each swimmer counted once, week by week." action={<PanelLink href={swimmersHref}>Swimmers</PanelLink>}
        figure={<><span className="ins-hero-value">{formatCount(o.swimmers.current ?? 0)}</span><Delta change={o.swimmers} better="up" label="since the start of the period" /><span className="ins-muted">since the period began</span></>}>
        <TrendChart label="Swimmers week by week" unit="swimmers" height={220} points={o.trend.map(t => ({ x: t.week, y: t.swimmers, label: week(t) }))} />
      </Panel>
      <Panel id="decisions" span={4} title="Decisions to make" sub={`${plural(decisions.filter(d => d.count).length, "thing")} worth a look.`}>
        <Attention items={decisions} />
      </Panel>
      <Panel id="flow" span={7} title="Joined and left each week" sub="Joiners rise above the line, leavers fall below it." action={<PanelLink href={`${swimmersHref}#leavers`}>Every leaver</PanelLink>}>
        <PairedColumns label="Swimmers who joined and left each week" a="Joined" b="Left" rows={o.trend.map(t => ({ key: t.week, label: formatDayMonth(t.week), title: week(t), a: t.joined, b: t.left }))} />
      </Panel>
      <Panel id="reasons" span={5} title="Why swimmers left" sub={o.left.current ? `${plural(o.left.current, "swimmer")} left in this period.` : "Nobody left in this period."}>
        {o.reasons.length ? <Bars share label="Leavers by reason" rows={o.reasons.map(r => ({ key: r.key, label: r.label, value: r.count, tone: r.key === "teaching" || r.key === "progress" ? "warn" as const : undefined }))} /> : null}
        {o.reasons.some(r => r.key === "none") ? <p className="ins-sub">Not recorded: unenrolled before Turnfin asked for a reason (16 October 2026).</p> : null}
      </Panel>
    </Section>

    <Section id="capacity" title="Capacity" intro={`Where to add or merge classes: the timetable ${asOf(data.period, "today")}, each level, and the coming weeks.`}>
      <Panel id="timetable" title="Where the timetable is full" sub="Places filled by day and start time. A gold edge means someone is waiting for a class in that slot." action={<PanelLink href={`${classesHref}#classes`}>Every class</PanelLink>}>
        <TimetableHeat capacity={data.capacity} />
      </Panel>
      <Panel span={6} id="levels" title="Each level" sub="Where swimmers wait and where places sit empty.">
        <div className="ins-table-wrap"><Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Level</TableHead>
            <TableHead scope="col" className="text-right">Classes</TableHead>
            <TableHead scope="col" className="text-right">Filled</TableHead>
            <TableHead scope="col" className="text-right">Free</TableHead>
            <TableHead scope="col" className="text-right">Waiting</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.capacity.levels.map(l => <TableRow key={l.levelId}>
            <TableHead scope="row" className="whitespace-normal"><span className="font-semibold">{l.name}</span><span className="ins-muted block">{l.programmeName}</span></TableHead>
            <TableCell className="ins-num">{l.classes}</TableCell>
            <TableCell className="ins-num"><span className="block">{l.enrolled} of {l.capacity}</span><Meter value={l.fill} /></TableCell>
            <TableCell className="ins-num">{l.empty}</TableCell>
            <TableCell className="ins-num">{l.waiting ? <span className="font-semibold">{l.waiting}</span> : <span className="ins-muted">0</span>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
      </Panel>
      <Panel span={6} id="forecast" title="The next four weeks" sub={`Places already booked from today, with places starting and ending. New joiners are not guessed. ${plural(data.forecast.waiting, "swimmer is", "swimmers are")} on a waiting list.`}>
        <div className="ins-table-wrap"><Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Week of</TableHead>
            <TableHead scope="col" className="text-right">Places</TableHead>
            <TableHead scope="col" className="text-right">Filled</TableHead>
            <TableHead scope="col" className="text-right">Starting</TableHead>
            <TableHead scope="col" className="text-right">Ending</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.forecast.weeks.map((w, i) => <TableRow key={w.date}>
            <TableHead scope="row">{i === 0 ? "Today" : formatDayMonth(w.date)}</TableHead>
            <TableCell className="ins-num">{formatCount(w.places)}<span className="ins-muted block">{formatCount(w.swimmers)} swimmers</span></TableCell>
            <TableCell className="ins-num"><Meter value={w.fill} /></TableCell>
            <TableCell className="ins-num">{i === 0 ? "—" : formatCount(w.starting)}</TableCell>
            <TableCell className="ins-num">{i === 0 ? "—" : w.ending ? <span className="font-semibold">{formatCount(w.ending)}</span> : "0"}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
      </Panel>
    </Section>

    <Section id="demand" title="Demand" intro="Whether assessments turn into places, and the ages we teach.">
      <Panel id="conversion" span={5} title="Assessments to places" sub={`${formatCount(a.sessions)} assessment sessions in the period.`}
        figure={<><span className="ins-hero-value">{percent(a.conversion)}</span><span className="ins-muted">booked to a place · {a.daysToClass !== null ? `${plural(a.daysToClass, "day")} to a first lesson, typically` : "no first lessons yet"}</span></>}>
        <Bars label="Assessments and what followed" rows={[
          { key: "attended", label: "Assessed", value: a.attended },
          { key: "placed", label: "Given a level", value: a.placed },
          { key: "converted", label: "Started a class", value: a.converted },
          { key: "noshow", label: "Did not come", value: a.noShow, tone: "warn" as const },
        ]} />
      </Panel>
      <Panel id="ages" span={7} title="Swimmers by age" sub={o.ages.unknown ? `${plural(o.ages.unknown, "swimmer")} with no date of birth left out.` : `Age ${data.period.current ? "today" : `on ${formatDayMonth(data.period.end)}`}.`}>
        <ColumnChart label="Swimmers by age" rows={o.ages.bands.map(b => ({ key: b.label, tick: b.label, short: b.label.replace(" to ", "–").replace(" and over", "+"), value: b.count }))} />
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
