import { formatCount, formatDayMonth, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { OverviewInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { Attention, Bars, Delta, Kpi, PairedColumns, Panel, PanelLink, percent, ReportShell, reportHref, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";

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
    { key: "registers", count: o.attention.missingRegisters, title: "Registers not complete", hint: "Finished lessons with swimmers left unmarked", href: "/analytics/instructors", tone: "bad" as const },
  ];
  return <ReportShell ctx={data} page="overview" path="/analytics" title="Analytics" footnotes={[
    "Swimmers are counted once however many classes they hold. Waiting lists, future starts and archived classes are left out. Moving class or site is not leaving.",
    "Places filled counts classes with a limit. Attendance is swimmers marked present or late out of everyone marked.",
  ]}>
    <ul className="ins-kpis" aria-label="The swim school at a glance">
      <Kpi label="Swimmers now" value={formatCount(o.swimmers.current ?? 0)} delta={<Delta change={o.swimmers} better="up" label="since the start of the period" />} note={`In ${plural(o.places, "class place")}. Change since the period began.`} href={swimmersHref} />
      <Kpi label="Places filled" value={percent(o.fill.rate)} note={`${formatCount(o.fill.enrolled)} of ${formatCount(o.fill.capacity)} places · ${formatCount(o.fill.empty)} free`} href={classesHref} />
      <Kpi label="Waiting list" value={formatCount(o.waiting.bookings)} note={`${plural(o.waiting.swimmers, "swimmer")} waiting for a place`} href={classesHref} />
      <Kpi label="Joined" value={formatCount(o.joined.current ?? 0)} delta={<Delta change={o.joined} better="up" label="against the period before" />} note={`${formatCount(o.newSwimmers)} new to the swim school`} href={swimmersHref} />
      <Kpi label="Left" value={formatCount(o.left.current ?? 0)} delta={<Delta change={o.left} better="down" label="against the period before" />} note="No place left at any site" href={`${swimmersHref}#leavers`} />
      <Kpi label="Stayed" value={percent(o.retention.rate)} note={`${formatCount(o.retention.stayed)} of the ${formatCount(o.retention.start)} here when the period began`} href={swimmersHref} />
      <Kpi label="Attendance" value={percent(o.attendance.current)} delta={<Delta change={o.attendance} better="up" unit="pts" label="against the period before" />} note={`${plural(o.lessons.held, "lesson")} held · ${formatCount(o.lessons.cancelled)} cancelled`} href={classesHref} />
      <Kpi label="Level passes" value={formatCount(o.passes.current ?? 0)} delta={<Delta change={o.passes} better="up" label="against the period before" />} note="Levels completed" href={reportHref(data, "/analytics/progression")} />
    </ul>
    <div className="ins-grid">
      <Panel id="trend" title="Swimmers week by week" sub="Swimmers with a place at the end of each week." action={<PanelLink href={swimmersHref}>Joiners and leavers</PanelLink>}>
        <TrendChart label="Swimmers week by week" points={o.trend.map(t => ({ x: t.week, y: t.swimmers, label: `Week of ${formatDayMonth(t.week)}` }))} />
        <h3 className="ins-minor">Joined and left each week</h3>
        <PairedColumns label="Swimmers who joined and left each week" a="Joined" b="Left" rows={o.trend.map(t => ({ key: t.week, label: formatDayMonth(t.week), a: t.joined, b: t.left }))} />
      </Panel>
      <Panel id="attention" title="Needs attention" sub="Open each one to see who and where.">
        <Attention items={attention} />
      </Panel>
    </div>
    <div className="ins-grid ins-even">
      <Panel id="reasons" title="Why swimmers left" sub={o.left.current ? `${plural(o.left.current, "swimmer")} left in this period.` : "Nobody left in this period."} action={<PanelLink href={`${swimmersHref}#leavers`}>Every leaver</PanelLink>}>
        {o.reasons.length ? <Bars label="Leavers by reason" rows={o.reasons.map(r => ({ key: r.key, label: r.label, value: r.count }))} /> : null}
        {o.reasons.some(r => r.key === "none") ? <p className="ins-sub">Not recorded: unenrolled before Turnfin asked for a reason (16 October 2026).</p> : null}
      </Panel>
      <Panel id="ages" title="Swimmers by age" sub={o.ages.unknown ? `${plural(o.ages.unknown, "swimmer")} with no date of birth left out.` : "Age today."}>
        <Bars label="Swimmers by age" rows={o.ages.bands.map(b => ({ key: b.label, label: b.label, value: b.count }))} />
      </Panel>
    </div>
  </ReportShell>;
}
