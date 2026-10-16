import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatDateTime, formatDayMonth, plural } from "@/lib/format";
import type { DeskPersonInsights } from "@/modules/activities/features/analytics/server/desk-data";
import { Bars, decimal, Kpi, KpiStrip, Meter, Panel, percent, reportHref, ReportShell, Section, TrendChart } from "@/modules/activities/features/analytics/components/insights/kit";
import { BusyHours, duration, outcomeLabel, Versus } from "@/modules/activities/features/analytics/components/insights/desk-kit";

type Person = NonNullable<DeskPersonInsights["person"]>;

export function DeskPersonReport({ data }: { data: DeskPersonInsights & { person: Person } }) {
  const { person: p, sites, weeks, heat, kinds, jobs, compare: c, followUps, corrections } = data.person;
  const hours = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
  return <ReportShell ctx={data} page="reception" path={`/analytics/reception/${encodeURIComponent(p.key)}`} back={{ href: reportHref(data, "/analytics/reception"), label: "Reception" }} title={p.name} programme={false} footnotes={[
    "Work done counts what this person recorded in Turnfin for the swim school, short courses, the Academy and refunds. Phone calls, emails and the till are not in Turnfin.",
    "Team figures are for everyone who did desk work at the same sites in the same period. Small numbers move a lot: read a quiet week with care.",
  ]}>
    <Section id="glance" eyebrow="At a glance" title="Their figures">
    <KpiStrip label={`${p.name} at a glance`}>
      <Kpi label="Work done" value={formatCount(p.actions)} note={`${percent(p.share)} of the desk · ${plural(p.days, "day")}`} />
      <Kpi label="Per day worked" value={decimal(p.perDay)} note={`Team average ${decimal(c.perDay.team)}`} />
      <Kpi label="Timed jobs" value={formatCount(p.jobsDone)} note={p.median !== null ? `Typically ${duration(p.median)}` : undefined} />
      <Kpi label="On time" value={percent(p.onTime)} note={`Team ${percent(data.team.onTime)}`} />
      <Kpi label="New swimmers" value={formatCount(p.added)} note={p.missingDetails !== null ? `${percent(p.missingDetails)} missing details` : undefined} />
      <Kpi label="Follow-ups" value={formatCount(p.followUps)} note={p.booked ? `${p.booked} assessments booked` : undefined} />
    </KpiStrip>
    </Section>
    <Section id="detail" eyebrow="In detail" title="Against the team" intro="Each figure beside the team's, their work week by week, what they did and when.">

    <Panel id="compare" title="Against the team" sub="Each figure beside the team's for the same sites and period.">
      <ul className="ins-compare">
        <Versus label="Work done per day worked" mine={c.perDay.mine} team={c.perDay.team} format={decimal} />
        <Versus label="Timed jobs on time" mine={c.onTime.mine} team={c.onTime.team} format={v => percent(v)} />
        <Versus label="New swimmers missing details" mine={c.missingDetails.mine} team={c.missingDetails.team} format={v => percent(v)} lowerBetter />
        <Versus label="Unenrols with no reason" mine={c.noReason.mine} team={c.noReason.team} format={v => percent(v)} lowerBetter />
        <Versus label="Places undone within a day" mine={c.corrections.mine} team={c.corrections.team} format={v => percent(v)} lowerBetter />
        <Versus label="Assessed swimmers who started a class" mine={c.startedRate.mine} team={c.startedRate.team} format={v => percent(v)} />
      </ul>
    </Panel>

    <Panel id="times" title="Their response times" sub="Jobs with a clock on them that this person finished, against everyone's.">
      {jobs.length ? <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Job</TableHead>
          <TableHead scope="col" className="text-right">Done</TableHead>
          <TableHead scope="col" className="text-right">Typical time</TableHead>
          <TableHead scope="col" className="text-right">Team typical</TableHead>
          <TableHead scope="col" className="text-right">On time</TableHead>
          <TableHead scope="col" className="text-right">Team on time</TableHead>
        </TableRow></TableHeader>
        <TableBody>{jobs.map(j => <TableRow key={j.kind}>
          <TableHead scope="row" className="min-w-44 whitespace-normal font-semibold">{j.label}<span className="ins-muted block">{percent(j.share)} of the team&apos;s</span></TableHead>
          <TableCell className="ins-num">{j.done}</TableCell>
          <TableCell className="ins-num">{duration(j.median)}</TableCell>
          <TableCell className="ins-num">{duration(j.teamMedian)}</TableCell>
          <TableCell className="ins-num"><Meter value={j.onTime} tone={j.onTime !== null && j.teamOnTime !== null && j.onTime < j.teamOnTime - 10 ? "warn" : undefined} /></TableCell>
          <TableCell className="ins-num"><Meter value={j.teamOnTime} /></TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <p className="ins-sub">No timed jobs finished by this person in this period.</p>}
    </Panel>

    <div className="ins-grid ins-even">
      <Panel id="weekly" title="Work week by week">
        <TrendChart label="Work done each week" points={weeks.map(w => ({ x: w.week, y: w.count, label: `Week of ${formatDayMonth(w.week)}` }))} />
      </Panel>
      <Panel id="kinds" title="What they worked on" sub={`Sites: ${sites.join(", ") || "none"}.`}>
        {kinds.length ? <Bars label="Work by kind" rows={kinds.map(k => ({ key: k.key, label: k.label, value: k.count, note: `${percent(k.team ? (k.count / k.team) * 100 : null)} of the team's` }))} /> : <p className="ins-sub">Nothing recorded in this period.</p>}
      </Panel>
    </div>

    <Panel id="busy" title="When they work" sub="Their recorded work by day of the week and hour (Irish time).">
      <BusyHours rows={heat} caption={`Work recorded by ${p.name} by day and hour`} />
    </Panel>

    <div className="ins-grid ins-even">
      <Panel id="follow-ups" title="Follow-up outcomes" sub={`${plural(followUps.logged, "call or message", "calls and messages")} logged about enrolment.`}>
        {followUps.outcomes.length ? <Bars label="Follow-up outcomes" rows={followUps.outcomes.map(o => ({ key: o.key, label: outcomeLabel(o.key), value: o.count }))} /> : <p className="ins-sub">No follow-ups logged in this period.</p>}
      </Panel>
      <Panel id="undone" title="Places undone within a day" sub="Places they made that were unenrolled within 24 hours.">
        {corrections.length ? <ul className="pc-rows">{corrections.map(x => <li key={x.at} className="pc-row"><div className="pc-row-body">
          <p className="pc-row-title">{formatDateTime(new Date(x.at))}</p>
          <p className="pc-row-hint">Unenrolled {hours.format(Math.max(1, x.hours))} {Math.round(x.hours) <= 1 ? "hour" : "hours"} later</p>
        </div></li>)}</ul> : <p className="ins-sub">None in this period.</p>}
      </Panel>
    </div>
    </Section>
  </ReportShell>;
}
