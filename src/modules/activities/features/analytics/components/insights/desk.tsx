import Link from "next/link";
import { formatCount, formatDayMonth, plural } from "@/lib/format";
import { Progress } from "@/components/shadcn/progress";
import type { DeskInsights } from "@/modules/activities/features/analytics/server/desk-data";
import { AreaChart, CompareColumns } from "@/modules/activities/features/analytics/components/insights/charts";
import { ChartHead, CompareList, MiniList, Sentence, SplitBar, BarsVersus, type CompareRow } from "@/modules/activities/features/analytics/components/insights/blocks";
import { PillSwitch, ShowTable, TileSwitch } from "@/modules/activities/features/analytics/components/insights/switches";
import { before, busiest, moved, weekOf } from "@/modules/activities/features/analytics/components/insights/words";
import { Attention, Bars, decimal, filterQuery, Flag, Panel, percent, ReportShell, Section } from "@/modules/activities/features/analytics/components/insights/kit";
import { BusyHours, channelLabel, duration, outcomeLabel } from "@/modules/activities/features/analytics/components/insights/desk-kit";
import { DeskTable } from "@/modules/activities/features/analytics/components/insights/desk-table";

const share = (n: number, d: number) => (d ? (n / d) * 100 : null);
const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** The reception dashboard (approved mockup, 20 October 2026), for the supervisor who manages the desk:
 *  what is worth a look first, the desk's figures as tiles that each open a chart, the team compared on
 *  one measure at a time, then how fast jobs get done, what is waiting, busy hours and enquiries. */
export function DeskReport({ data }: { data: DeskInsights }) {
  const d = data.desk;
  const q = d.quality, b = d.bookings, f = d.followUps;
  const query = filterQuery(data);
  const was = before(data.period);
  const complete = share(q.added - q.missing, q.added), reasons = share(q.unenrols - q.noReason, q.unenrols);
  const active = d.people.filter(p => p.actions || p.jobsDone);

  const todo = [
    { key: "late", count: d.open.overdue, title: "Jobs past their target", hint: d.open.oldest.find(j => j.overdue) ? `The longest is a ${d.open.oldest.find(j => j.overdue)!.label.toLowerCase()}, waiting ${duration(d.open.oldest.find(j => j.overdue)!.minutes)}.` : "Every waiting job is inside its target.", href: "#waiting", tone: "warn" as const },
    { key: "follow", count: f.overdue, title: "Swimmers past their follow-up date", hint: "Someone promised to call back and has not yet.", href: "#follow-ups", tone: "warn" as const },
    { key: "details", count: q.missing, title: "New swimmers missing details", hint: `Of ${plural(q.added, "new swimmer")} added: ${[q.noBirthday ? `${q.noBirthday} no date of birth` : "", q.noPhone ? `${q.noPhone} no phone` : "", q.noEmergency ? `${q.noEmergency} no emergency phone` : ""].filter(Boolean).join(", ") || "all complete"}.`, href: "#quality", tone: "warn" as const },
    { key: "undone", count: d.corrections, title: "Places undone within a day", hint: "Made, then unenrolled within 24 hours, usually the wrong class.", href: "#quality", tone: "warn" as const },
  ];
  const open = todo.filter(t => t.count).length;

  const weekly = d.weekly;
  const workWeek = busiest(weekly, w => w.work);
  const line = (pick: (w: typeof weekly[number]) => number | null) => weekly.filter(w => pick(w) !== null).map(w => ({ x: w.week, tick: formatDayMonth(w.week), y: pick(w)!, title: weekOf(w.week) }));
  const tiles = [
    { key: "work", label: "Jobs done", value: formatCount(d.total), change: moved(d.total, d.previousTotal, { better: "none", against: was }), note: `${plural(active.length, "person", "people")}, ${decimal(d.perPerson)} each` },
    { key: "onTime", label: "On time", value: percent(d.onTime), note: "Timed jobs done within their target" },
    { key: "waiting", label: "Still waiting", value: formatCount(d.open.count), note: d.open.overdue ? `${d.open.overdue} past their target` : "None past their target", href: "#waiting" },
    { key: "complete", label: "New swimmers complete", value: percent(complete), note: `${formatCount(q.added)} added` },
    { key: "reasons", label: "Unenrols with a reason", value: percent(reasons), note: `${formatCount(q.unenrols)} since reasons were asked` },
    { key: "undone", label: "Undone in a day", value: formatCount(d.corrections), note: "Places made then unenrolled within 24 hours" },
  ];
  const panels = {
    work: <>
      <ChartHead title="Jobs done each week">{`The desk did ${plural(d.total, "job")}, against ${formatCount(d.previousTotal)} in ${was}.${workWeek ? ` The busiest was ${workWeek}.` : ""}`}</ChartHead>
      <CompareColumns label="Desk jobs each week" unit="jobs" previousLabel={`Same week, ${was}`} rows={weekly.map(w => ({ key: w.week, tick: formatDayMonth(w.week), title: weekOf(w.week), value: w.work, previous: w.before }))} />
    </>,
    onTime: <>
      <ChartHead title="Timed jobs done on time, week by week">{d.onTime !== null ? `${percent(d.onTime)} of timed jobs were done within their target, for example a parent app request within a day.` : "No timed jobs were done in this period."}</ChartHead>
      <AreaChart label="Jobs on time week by week" kind="percent" unit="on time" height={240} points={line(w => w.onTime)} />
    </>,
    complete: <>
      <ChartHead title="New swimmers with every detail, week by week">{complete !== null ? `${percent(complete)} of the ${plural(q.added, "new swimmer")} added have a date of birth, a phone and an emergency phone.` : "No new swimmers were added in this period."}</ChartHead>
      <AreaChart label="New swimmers complete week by week" kind="percent" unit="complete" height={240} points={line(w => w.complete)} />
    </>,
    reasons: <>
      <ChartHead title="Unenrols with a reason, week by week">{reasons !== null ? `${percent(reasons)} of ${plural(q.unenrols, "unenrol")} say why the swimmer left. The reasons feed Who left on the Business dashboard.` : "No unenrols since reasons were first asked on 16 October 2026."}</ChartHead>
      <AreaChart label="Unenrols with a reason week by week" kind="percent" unit="with a reason" height={240} points={line(w => w.reasons)} />
    </>,
    undone: <>
      <ChartHead title="Places undone within a day, each week">{d.corrections ? `${plural(d.corrections, "place was", "places were")} made and then unenrolled within 24 hours, usually because it was the wrong class.` : "No places were undone within a day."}</ChartHead>
      <CompareColumns label="Places undone within a day each week" unit="undone" tone="b" previousLabel="Not kept for the period before" rows={weekly.map(w => ({ key: w.week, tick: formatDayMonth(w.week), title: weekOf(w.week), value: w.undone, previous: null }))} />
    </>,
  };

  // The team, one measure at a time.
  const person = (p: typeof d.people[number]) => ({ key: p.key, name: p.name, sub: `${plural(p.days, "day")} on the desk`, href: `/analytics/reception/${encodeURIComponent(p.key)}${query}` });
  const teamPerDay = mean(active.map(p => p.perDay)), teamFollow = mean(active.map(p => p.followUps)), teamUndone = mean(active.map(p => p.corrections));
  const missingOf = (p: typeof d.people[number]) => Math.round(p.added * (p.missingDetails ?? 0) / 100);
  const noReasonOf = (p: typeof d.people[number]) => Math.round(p.unenrols * (p.noReason ?? 0) / 100);
  const measures: { key: string; label: string; help: string; average: number | null; averageText: string; max?: number; rows: CompareRow[] }[] = [
    { key: "perDay", label: "Jobs a day", help: "Jobs finished for each day they worked.", average: teamPerDay, averageText: decimal(teamPerDay),
      rows: active.map(p => ({ ...person(p), value: p.perDay, text: decimal(p.perDay), note: p.perDay !== null && teamPerDay !== null && p.perDay < teamPerDay - 2 ? `${decimal(teamPerDay - p.perDay)} fewer jobs a day than the team. Quieter shifts do fewer, so check before raising it.` : null })) },
    { key: "work", label: "Jobs done", help: "Every desk job each person finished. People on fewer days will do fewer, so Jobs a day is the fairer comparison.", average: d.perPerson, averageText: decimal(d.perPerson),
      rows: active.map(p => ({ ...person(p), value: p.actions, text: formatCount(p.actions) })) },
    { key: "onTime", label: "On time", help: "How many of their timed jobs were finished within the target.", average: d.onTime, averageText: percent(d.onTime), max: 100,
      rows: active.filter(p => p.onTime !== null).map(p => ({ ...person(p), value: p.onTime, text: percent(p.onTime), note: d.onTime !== null && p.onTime! < d.onTime - 10 ? `${Math.round(d.onTime - p.onTime!)} points behind the team, over ${plural(p.jobsDone, "timed job")}.` : null })) },
    { key: "complete", label: "Full details", help: "How many of the new swimmers they added have every detail filled in, such as an emergency phone number.", average: complete, averageText: percent(complete), max: 100,
      rows: active.filter(p => p.added).map(p => ({ ...person(p), value: 100 - (p.missingDetails ?? 0), text: percent(100 - (p.missingDetails ?? 0)), note: missingOf(p) >= 3 ? `${missingOf(p)} of the ${p.added} new swimmers they added are missing details.` : null })) },
    { key: "reasons", label: "Reasons given", help: "How many of their unenrols say why the swimmer left.", average: reasons, averageText: percent(reasons), max: 100,
      rows: active.filter(p => p.unenrols).map(p => ({ ...person(p), value: 100 - (p.noReason ?? 0), text: percent(100 - (p.noReason ?? 0)), note: noReasonOf(p) >= 4 ? `${noReasonOf(p)} of their ${p.unenrols} unenrols have no reason.` : null })) },
    { key: "follow", label: "Follow-up calls", help: "Calls and messages to families they logged about enrolment.", average: teamFollow, averageText: decimal(teamFollow),
      rows: active.map(p => ({ ...person(p), value: p.followUps, text: formatCount(p.followUps) })) },
    { key: "undone", label: "Undone in a day", help: "Places they made that were unenrolled again within 24 hours. Fewer is better.", average: teamUndone, averageText: decimal(teamUndone),
      rows: active.map(p => ({ ...person(p), value: p.corrections, text: formatCount(p.corrections), note: p.corrections >= 3 ? `${p.corrections} places undone in a day. Worth checking they are picking the right class.` : null })) },
  ];

  return <ReportShell ctx={data} page="reception" path="/analytics/reception" title="Reception" description="How the desk is serving families, and how each person is getting on." programme={false} footnotes={[
    "Jobs done counts what each person recorded in Turnfin for the swim school, short courses, the Academy and refunds: enrolments, moves, unenrols, swimmer records, parent app requests, follow-up calls, billing checks, bookings and refund requests. Phone calls, emails and the till are not in Turnfin, so they are not counted.",
    "Timed jobs run from when the job reached the desk to when it was done, against a target: parent app requests within a day, cancelled classes to billing within two days, billing agreements within a week, swimmers ready to move within two weeks, Academy call backs within 72 hours. Still waiting counts jobs not done yet.",
    "Undone in a day counts places made and then unenrolled within 24 hours by anyone, against whoever made the place: a sign of a mistake or a change of mind. Unenrols with no reason count from 16 October 2026, when the reason was first asked.",
    ...(data.failed.length ? [`Some figures could not be read this time (${data.failed.join(", ")}). Refresh to try again.`] : []),
  ]}>
    <Panel id="todo" title="Worth a look first" sub={open ? `${plural(open, "thing")} to follow up.` : "Nothing needs following up right now."}>
      <Attention columns items={todo} />
    </Panel>

    <Section id="desk" title="How the desk is doing" intro="Pick a figure to see it week by week.">
      <Panel id="trend" title="The desk at a glance" className="ins-panel-flush">
        <TileSwitch label="The desk at a glance" tiles={tiles} panels={panels} />
      </Panel>
    </Section>

    <Section id="team" title="The team" intro="Pick one thing to compare. Everyone is on the same scale, and a bar turns orange when it is worth a word. Open a person for everything about them.">
      <Panel id="people" title="Each person">
        <PillSwitch label="Compare by" options={measures.map(m => ({ key: m.key, label: m.label }))} panels={Object.fromEntries(measures.map(m => [m.key, <CompareList key={m.key} label={`The team by ${m.label.toLowerCase()}`} word="team" help={m.help} average={m.average} averageText={m.averageText} max={m.max} rows={m.rows} />]))} />
        <ShowTable label="Show everyone as a table">
          <DeskTable people={d.people} teamOnTime={d.onTime} query={query} />
        </ShowTable>
      </Panel>
    </Section>

    <Section id="service" title="Service" intro="How quickly jobs with a clock on them get done, what is still waiting now, and how complete the records are.">
      <Panel id="times" span={7} title="How fast the desk answers" sub="Each kind of job with a clock on it. The bar is how many were done within their target.">
        {d.jobs.length ? <ul className="ins-jobs">{d.jobs.map(j => <li key={j.kind}>
          <span className="ins-jobs-what">
            {j.href ? <Link href={j.href} className="ins-jobs-name">{j.label}</Link> : <span className="ins-jobs-name">{j.label}</span>}
            <span className="ins-jobs-hint">{[`${formatCount(j.done)} done`, j.median !== null ? `usually ${duration(j.median)}` : null, j.target !== null ? `target ${duration(j.target)}` : null].filter(Boolean).join(", ")}.{j.open ? ` ${formatCount(j.open)} waiting now${j.overdue ? `, ${j.overdue} late` : ""}, the longest ${duration(j.oldest)}.` : ""}{j.hint ? ` ${j.hint}` : ""}</span>
          </span>
          <span className="ins-jobs-bar" data-tone={j.onTime !== null && j.onTime < 80 ? "warn" : undefined}>
            <Progress value={Math.min(100, j.onTime ?? 0)} aria-hidden="true" className="ins-bar-track" />
            <strong>{j.onTime !== null ? `${percent(j.onTime)} on time` : "No target"}</strong>
          </span>
        </li>)}</ul> : <p className="ins-sub">No timed jobs in this period.</p>}
      </Panel>
      <Panel id="waiting" span={5} title="Still waiting" sub={d.open.count ? `${plural(d.open.count, "job")} not done yet, longest first.` : undefined}>
        <MiniList label="Jobs still waiting" empty="Nothing is waiting for the desk." rows={d.open.oldest.map((j, i) => ({
          key: `${j.kind}-${i}`, title: j.label, href: j.href ?? undefined,
          hint: [`Waiting ${duration(j.minutes)}`, data.allSites ? j.siteName ?? "Every site" : null].filter(Boolean).join(" · "),
          value: j.overdue ? <Flag tone="warn">Past target</Flag> : undefined,
        }))} />
      </Panel>
      <Panel id="quality" span={6} title="Record quality" sub="New swimmers added without key details, and unenrols with no reason given.">
        <Attention items={[
          { key: "birthday", count: q.noBirthday, title: "No date of birth", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "phone", count: q.noPhone, title: "No contact phone", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "emergency", count: q.noEmergency, title: "No emergency phone", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "reason", count: q.noReason, title: "Unenrols with no reason", hint: `Of ${plural(q.unenrols, "unenrol")} since reasons were asked`, tone: "warn" },
          { key: "undone", count: d.corrections, title: "Places undone within a day", hint: "Made then unenrolled within 24 hours", tone: "warn" },
        ]} />
      </Panel>
      <Panel id="kinds" span={6} title="What the desk spent its time on" sub="Each kind of work recorded, with the period before marked on each bar.">
        {d.kinds.length ? <BarsVersus label="Work by kind" previousLabel={was.replace(/^the /, "The ")} rows={d.kinds.map(k => ({ key: k.key, label: k.label, value: k.count, previous: k.previous }))} /> : <p className="ins-sub">Nothing recorded in this period.</p>}
      </Panel>
    </Section>

    <Section id="rostering" title="Busy hours" intro="Match staff on the desk to the busy times.">
      <Panel id="busy" title="When the desk is busy" sub="When the work was recorded, by day of the week and hour (Irish time). Darker is busier.">
        <BusyHours rows={d.heat} caption="Desk work recorded by day of the week and hour" />
      </Panel>
    </Section>

    <Section id="enquiries" title="Enquiries" intro="Follow-up calls about enrolment, and assessment bookings that went on to a class.">
      <Panel span={6} id="follow-ups" title="Follow-up calls" sub={`${plural(f.logged, "call or message", "calls and messages")} logged about enrolment. ${f.overdue ? `${f.overdue} swimmers are past their next contact date.` : "No swimmer is past their next contact date."}`}>
        {f.outcomes.length ? <>
          <Bars label="Follow-up outcomes" rows={f.outcomes.map(o => ({ key: o.key, label: outcomeLabel(o.key), value: o.count }))} />
          <Sentence>{`By ${f.channels.map(c => `${channelLabel(c.key).toLowerCase()} ${c.count}`).join(", ")}.`}</Sentence>
        </> : <p className="ins-sub">No follow-ups logged in this period.</p>}
      </Panel>
      <Panel span={6} id="assessments" title="Assessment bookings" sub={`${plural(b.booked, "place")} booked on assessments in the period${b.parentApp ? `, ${b.parentApp} by parents in the app` : ""}.`}
        figure={<><span className="ins-hero-value">{percent(share(b.started, b.attended))}</span><span className="ins-muted">of those assessed started a class within two months</span></>}>
        <SplitBar label="Assessment bookings" parts={[
          { key: "started", label: "came and started a class", value: b.started, tone: "a" },
          { key: "came", label: "came, no class yet", value: Math.max(0, b.attended - b.started), tone: "muted" },
          { key: "noshow", label: "did not come", value: b.noShow, tone: "b" },
          { key: "cancelled", label: "cancelled", value: b.cancelled, tone: "muted" },
        ]} />
        <Sentence>{`${percent(share(b.attended, b.booked))} of bookings came to their assessment and ${percent(share(b.noShow, b.booked))} did not come.`}</Sentence>
      </Panel>
    </Section>
  </ReportShell>;
}
