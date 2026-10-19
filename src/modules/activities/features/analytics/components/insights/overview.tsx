import { formatCount, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { OverviewInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { asOf, Attention, Bars, ColumnChart, Delta, Kpi, KpiStrip, PairedColumns, Panel, PanelLink, percent, ReportShell, reportHref, Section, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";

export function OverviewReport({ data }: { data: OverviewInsights }) {
  const o = data.overview;
  const swimmersHref = reportHref(data, "/analytics/swimmers");
  const classesHref = reportHref(data, "/analytics/classes");
  const attention = [
    { key: "risk", count: o.attention.atRisk, title: "Swimmers who may leave", hint: "Missed three in a row, or came to under 60% of their last eight lessons", href: `${swimmersHref}#at-risk`, tone: "warn" as const },
    { key: "leaving", count: o.attention.leaving, title: "Leaving soon", hint: "A last lesson is booked in", href: `${swimmersHref}#leaving`, tone: "warn" as const },
    { key: "full", count: o.attention.fullCount, title: "Full classes with a waiting list", hint: o.attention.fullWithWaiting.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.waiting} waiting)`).join(" · ") || "Room in every class with a waiting list", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "quiet", count: o.attention.quietCount, title: "Classes under half full", hint: o.attention.quiet.slice(0, 2).map(c => `${c.name} ${formatSlotShort(c)} (${c.enrolled} of ${c.capacity})`).join(" · ") || "Every class is at least half full", href: `${classesHref}#classes`, tone: "warn" as const },
    { key: "stuck", count: o.attention.stuck, title: "Swimmers at one level over 6 months", hint: "May need a different class or a word with the teacher", href: reportHref(data, "/analytics/progression"), tone: "warn" as const },
    { key: "starts", count: o.attention.missedStarts, title: "Lessons with no start record", hint: "Nobody started the class on the pool deck", href: reportHref(data, "/analytics/teachers"), tone: "bad" as const },
    { key: "desk", count: data.deskOverdue, title: "Reception jobs past their target", hint: "Parent app requests, billing checks and moves waiting too long", href: reportHref(data, "/analytics/reception") + "#waiting", tone: "warn" as const },
    { key: "registers", count: o.attention.missingRegisters, title: "Registers not complete", hint: "Finished lessons with swimmers left unmarked", href: "/analytics/instructors", tone: "bad" as const },
  ];
  const now = asOf(data.period);
  const week = (t: { week: string }) => `Week of ${formatDayMonth(t.week)}`;
  return <ReportShell ctx={data} page="overview" path="/analytics" title="Overview" sections={[
    { id: "glance", label: "At a glance" }, { id: "act", label: "Needs attention" }, { id: "growth", label: "Growth" }, { id: "who", label: "Who we teach" },
  ]} footnotes={[
    "Swimmers are counted once however many classes they hold. Waiting lists, future starts and archived classes are left out. Moving class or site is not leaving.",
    "Places filled counts classes with a limit. Attendance is swimmers marked present or late out of everyone marked. The small lines under figures show the weeks of the period.",
  ]}>
    <Section id="glance" title="At a glance" intro="Each figure opens the page behind it. Arrows compare with the period before.">
      <Panel id="trend" span={7} className="ins-hero-panel" title={`Swimmers ${now}`} sub={`In ${plural(o.places, "class place")}, each swimmer counted once. Week by week below.`} action={<PanelLink href={swimmersHref}>Swimmers</PanelLink>}
        figure={<><span className="ins-hero-value">{formatCount(o.swimmers.current ?? 0)}</span><Delta change={o.swimmers} better="up" label="since the start of the period" /><span className="ins-muted">since the period began</span></>}>
        <TrendChart label="Swimmers week by week" unit="swimmers" height={240} points={o.trend.map(t => ({ x: t.week, y: t.swimmers, label: week(t) }))} />
      </Panel>
      <KpiStrip label="The swim school at a glance" span={5}>
        <Kpi label={`Places filled${data.period.current ? "" : ` ${now}`}`} value={percent(o.fill.rate)} meter={o.fill.rate} note={`${formatCount(o.fill.enrolled)} of ${formatCount(o.fill.capacity)} places · ${formatCount(o.fill.empty)} free`} href={classesHref} />
        <Kpi label="Waiting list" value={formatCount(o.waiting.bookings)} note={`${plural(o.waiting.swimmers, "swimmer")} waiting for a place today`} href={classesHref} />
        <Kpi label="Joined" value={formatCount(o.joined.current ?? 0)} spark={o.trend.map(t => t.joined)} delta={<Delta change={o.joined} better="up" label="against the period before" />} note={`${formatCount(o.newSwimmers)} new to the swim school`} href={swimmersHref} />
        <Kpi label="Left" value={formatCount(o.left.current ?? 0)} spark={o.trend.map(t => t.left)} delta={<Delta change={o.left} better="down" label="against the period before" />} note="No place left at any site" href={`${swimmersHref}#leavers`} />
      </KpiStrip>
      <KpiStrip label="Keeping and teaching swimmers">
        <Kpi label="Stayed" value={percent(o.retention.rate)} meter={o.retention.rate} note={`${formatCount(o.retention.stayed)} of the ${formatCount(o.retention.start)} here when the period began`} href={swimmersHref} />
        <Kpi label="Attendance" value={percent(o.attendance.current)} spark={o.trend.map(t => t.attendance)} delta={<Delta change={o.attendance} better="up" unit="pts" label="against the period before" />} note={`${plural(o.lessons.held, "lesson")} held · ${formatCount(o.lessons.cancelled)} cancelled`} href={classesHref} />
        <Kpi label="Level passes" value={formatCount(o.passes.current ?? 0)} spark={o.trend.map(t => t.passes)} delta={<Delta change={o.passes} better="up" label="against the period before" />} note="Levels completed" href={reportHref(data, "/analytics/progression")} />
      </KpiStrip>
    </Section>
    <Section id="act" title="Needs attention" intro="The few things worth a look this week. Open each one to see who and where.">
      <Panel id="attention" title="To act on" sub={`${plural(attention.filter(a => a.count).length, "check")} of ${attention.length} need a look.`} className="ins-wide-list">
        <Attention items={attention} />
      </Panel>
    </Section>
    <Section id="growth" title="Growth" intro="Who joined and left each week, and why swimmers left.">
      <Panel id="flow" span={7} title="Joined and left each week" sub="Joiners rise above the line, leavers fall below it." action={<PanelLink href={`${swimmersHref}#leavers`}>Every leaver</PanelLink>}>
        <PairedColumns label="Swimmers who joined and left each week" a="Joined" b="Left" rows={o.trend.map(t => ({ key: t.week, label: formatDayMonth(t.week), title: week(t), a: t.joined, b: t.left }))} />
      </Panel>
      <Panel id="reasons" span={5} title="Why swimmers left" sub={o.left.current ? `${plural(o.left.current, "swimmer")} left in this period.` : "Nobody left in this period."} action={<PanelLink href={`${swimmersHref}#leavers`}>Every leaver</PanelLink>}>
        {o.reasons.length ? <Bars share label="Leavers by reason" rows={o.reasons.map(r => ({ key: r.key, label: r.label, value: r.count }))} /> : null}
        {o.reasons.some(r => r.key === "none") ? <p className="ins-sub">Not recorded: unenrolled before Turnfin asked for a reason (16 October 2026).</p> : null}
      </Panel>
    </Section>
    <Section id="who" title="Who we teach" intro="Ages are worked out from each swimmer's date of birth.">
      <Panel id="ages" title="Swimmers by age" sub={o.ages.unknown ? `${plural(o.ages.unknown, "swimmer")} with no date of birth left out.` : `Age ${data.period.current ? "today" : `on ${formatDayMonth(data.period.end)}`}.`}>
        <ColumnChart label="Swimmers by age" rows={o.ages.bands.map(b => ({ key: b.label, tick: b.label, short: b.label.replace(" to ", "–").replace(" and over", "+"), value: b.count }))} />
      </Panel>
    </Section>
  </ReportShell>;
}
