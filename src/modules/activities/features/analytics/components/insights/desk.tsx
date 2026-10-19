import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatDayMonth, plural } from "@/lib/format";
import type { DeskInsights } from "@/modules/activities/features/analytics/server/desk-data";
import { Attention, Bars, decimal, Delta, filterQuery, Flag, Kpi, KpiStrip, Meter, Panel, percent, ReportShell, Section, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";
import { BusyHours, channelLabel, duration, outcomeLabel } from "@/modules/activities/features/analytics/components/insights/desk-kit";
import { DeskTable } from "@/modules/activities/features/analytics/components/insights/desk-table";

const share = (n: number, d: number) => (d ? (n / d) * 100 : null);

export function DeskReport({ data }: { data: DeskInsights }) {
  const d = data.desk;
  const q = d.quality, b = d.bookings, f = d.followUps;
  const query = filterQuery(data);
  const totalChange = { current: d.total, previous: d.previousTotal, change: d.previousTotal ? d.total - d.previousTotal : null };
  return <ReportShell ctx={data} page="reception" path="/analytics/reception" title="Reception" programme={false} sections={[
    { id: "glance", label: "At a glance" }, { id: "service", label: "Service" }, { id: "workload", label: "Workload" }, { id: "team", label: "The team" }, { id: "enquiries", label: "Enquiries" },
  ]} footnotes={[
    "Work done counts what each person recorded in Turnfin for the swim school, short courses, the Academy and refunds: enrolments, moves, unenrols, swimmer records, parent app requests, follow-up calls, billing checks, bookings and refund requests. Phone calls, emails and the till are not in Turnfin, so they are not counted.",
    "Timed jobs run from when the job reached the desk to when it was done, against a target: parent app requests within a day, cancelled classes to billing within two days, billing agreements within a week, swimmers ready to move within two weeks, Academy call backs within 72 hours. Still waiting counts jobs not done yet.",
    "Undone in a day counts places made and then unenrolled within 24 hours by anyone, against whoever made the place: a sign of a mistake or a change of mind. Unenrols with no reason count from 16 October 2026, when the reason was first asked.",
    ...(data.failed.length ? [`Some figures could not be read this time (${data.failed.join(", ")}). Refresh to try again.`] : []),
  ]}>
    <Section id="glance" title="At a glance" intro="Everything reception recorded in Turnfin in the period.">
    <KpiStrip label="The desk at a glance">
      <Kpi label="Work done" value={formatCount(d.total)} spark={d.weeks.map(w => w.count)} note={`${plural(d.people.filter(p => p.actions).length, "person", "people")} · ${decimal(d.perPerson)} each`} delta={<Delta change={totalChange} better="none" label="against the period before" />} />
      <Kpi label="Jobs on time" value={percent(d.onTime)} note="Timed jobs done within their target" />
      <Kpi label="Still waiting" value={formatCount(d.open.count)} note={d.open.overdue ? `${d.open.overdue} past their target` : "None past their target"} />
      <Kpi label="New swimmers complete" value={percent(share(q.added - q.missing, q.added))} note={`${formatCount(q.added)} added`} />
      <Kpi label="Unenrols with a reason" value={percent(share(q.unenrols - q.noReason, q.unenrols))} note={`${formatCount(q.unenrols)} since reasons were asked`} />
      <Kpi label="Undone in a day" value={formatCount(d.corrections)} note="Places made then unenrolled within 24 hours" />
    </KpiStrip>
    </Section>
    <Section id="service" title="Service" intro="How quickly jobs with a clock on them get done, what is still waiting now, and how complete the records are.">
    <Panel id="times" title="How fast the desk answers" sub="Each kind of job with a clock on it: how many were done, the typical time, the share within target, and what is still waiting.">
      {d.jobs.length ? <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Job</TableHead>
          <TableHead scope="col" className="text-right">Done</TableHead>
          <TableHead scope="col" className="text-right">Typical time</TableHead>
          <TableHead scope="col" className="text-right">Target</TableHead>
          <TableHead scope="col" className="text-right">On time</TableHead>
          <TableHead scope="col" className="text-right">Waiting now</TableHead>
          <TableHead scope="col" className="text-right">Longest wait</TableHead>
        </TableRow></TableHeader>
        <TableBody>{d.jobs.map(j => <TableRow key={j.kind}>
          <TableHead scope="row" className="min-w-52 whitespace-normal">
            {j.href ? <Link href={j.href} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{j.label}</Link> : <span className="inline-flex min-h-11 items-center font-semibold">{j.label}</span>}
            {j.hint ? <span className="ins-muted block">{j.hint}</span> : null}
          </TableHead>
          <TableCell className="ins-num">{j.done}</TableCell>
          <TableCell className="ins-num">{duration(j.median)}</TableCell>
          <TableCell className="ins-num">{j.target !== null ? duration(j.target) : "—"}</TableCell>
          <TableCell className="ins-num"><Meter value={j.onTime} tone={j.onTime !== null && j.onTime < 80 ? "warn" : undefined} /></TableCell>
          <TableCell className="ins-num">{j.open}{j.overdue ? <span className="ins-muted block">{j.overdue} late</span> : null}</TableCell>
          <TableCell className="ins-num">{duration(j.oldest)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <p className="ins-sub">No timed jobs in this period.</p>}
    </Panel>

      <Panel span={5} id="waiting" title="Still waiting" sub={d.open.count ? `${plural(d.open.count, "job")} not done yet, longest first.` : undefined}>
        {d.open.oldest.length ? <ul className="pc-rows">{d.open.oldest.map((j, i) => <li key={`${j.kind}-${i}`} className="pc-row"><div className="pc-row-body">
          <p className="pc-row-title">{j.href ? <Link href={j.href} className="text-ui-primary hover:underline">{j.label}</Link> : j.label}</p>
          <p className="pc-row-hint">{[`Waiting ${duration(j.minutes)}`, data.allSites ? j.siteName ?? "Every site" : null].filter(Boolean).join(" · ")}</p>
        </div><div className="pc-row-trail">{j.overdue ? <Flag tone="warn">Past target</Flag> : null}</div></li>)}</ul> : <p className="ins-sub">Nothing is waiting for the desk.</p>}
      </Panel>
      <Panel span={7} id="quality" title="Record quality" sub="New swimmers added without key details, and unenrols with no reason given.">
        <Attention items={[
          { key: "birthday", count: q.noBirthday, title: "No date of birth", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "phone", count: q.noPhone, title: "No contact phone", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "emergency", count: q.noEmergency, title: "No emergency phone", hint: `Of ${plural(q.added, "new swimmer")}`, tone: "warn" },
          { key: "reason", count: q.noReason, title: "Unenrols with no reason", hint: `Of ${plural(q.unenrols, "unenrol")} since reasons were asked`, tone: "warn" },
          { key: "undone", count: d.corrections, title: "Places undone within a day", hint: "Made then unenrolled within 24 hours", tone: "warn" },
        ]} />
      </Panel>

    </Section>
    <Section id="workload" title="Workload" intro="Use the busy hours to match staff on the desk to the busy times.">
      <Panel span={5} id="kinds" title="What the desk spent its time on" sub="Each kind of work recorded, with the period before in brackets.">
        {d.kinds.length ? <Bars label="Work by kind" rows={d.kinds.map(k => ({ key: k.key, label: `${k.label} (${formatCount(k.previous)})`, value: k.count }))} /> : <p className="ins-sub">Nothing recorded in this period.</p>}
      </Panel>
      <Panel span={7} id="weekly" title="Work week by week">
        <TrendChart label="Desk work each week" unit="actions" points={d.weeks.map(w => ({ x: w.week, y: w.count, label: `Week of ${formatDayMonth(w.week)}` }))} />
      </Panel>

    <Panel id="busy" title="Busy hours" sub="When the work was recorded, by day of the week and hour (Irish time).">
      <BusyHours rows={d.heat} caption="Desk work recorded by day of the week and hour" />
    </Panel>

    </Section>
    <Section id="team" title="The team" intro="Sort, search and open a person for their week-by-week work, their times against the team and their busy hours.">
    <Panel id="people" title="Every person">
      <DeskTable people={d.people} teamOnTime={d.onTime} query={query} />
    </Panel>

    </Section>
    <Section id="enquiries" title="Enquiries" intro="Follow-up calls about enrolment, and assessment bookings that went on to a class.">
      <Panel span={6} id="follow-ups" title="Follow-up calls" sub={`${plural(f.logged, "call or message", "calls and messages")} logged about enrolment. ${f.overdue ? `${f.overdue} swimmers are past their next contact date.` : "No swimmer is past their next contact date."}`}>
        {f.outcomes.length ? <>
          <Bars label="Follow-up outcomes" rows={f.outcomes.map(o => ({ key: o.key, label: outcomeLabel(o.key), value: o.count }))} />
          <p className="ins-muted">{f.channels.map(c => `${channelLabel(c.key)} ${c.count}`).join(" · ")}</p>
        </> : <p className="ins-sub">No follow-ups logged in this period.</p>}
      </Panel>
      <Panel span={6} id="assessments" title="Assessment bookings" sub="Places booked on assessment sessions in the period, and whether those swimmers went on to start a class within two months.">
        <Attention items={[
          { key: "booked", count: b.booked, title: "Booked", hint: b.parentApp ? `${b.parentApp} booked by parents in the app` : "All booked by staff" },
          { key: "attended", count: b.attended, title: "Came to their assessment", hint: percent(share(b.attended, b.booked)) + " of bookings" },
          { key: "noshow", count: b.noShow, title: "Did not come", hint: percent(share(b.noShow, b.booked)) + " of bookings", tone: "warn" },
          { key: "started", count: b.started, title: "Started a class", hint: percent(share(b.started, b.attended)) + " of those assessed" },
        ]} />
      </Panel>
    </Section>
  </ReportShell>;
}
