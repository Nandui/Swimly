import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatDate, formatMonth, parseDateOnly, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { SwimmerInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { asOf, Attention, Bars, ColumnChart, Flag, Kpi, KpiStrip, Meter, PairedColumns, Panel, percent, ReportShell, reportHref, Section, weeks, type ReportContext } from "@/modules/activities/features/analytics/components/insights/kit";

type Person = SwimmerInsights["swimmers"]["leavers"][number];

function SwimmerName({ ctx, id, name }: { ctx: ReportContext; id: string; name: string }) {
  return ctx.canOpenSwimmers
    ? <Link href={`/students/${id}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{name}</Link>
    : <span className="font-semibold">{name}</span>;
}

function LeaverTable({ ctx, rows, upcoming }: { ctx: ReportContext; rows: Person[]; upcoming?: boolean }) {
  return <div className="ins-table-wrap"><Table>
    <TableHeader><TableRow>
      <TableHead scope="col">Swimmer</TableHead>
      <TableHead scope="col">{upcoming ? "Last place ends" : "Left"}</TableHead>
      <TableHead scope="col">Reason</TableHead>
      <TableHead scope="col">Last class</TableHead>
      <TableHead scope="col">Last taught by</TableHead>
      <TableHead scope="col" className="text-right">Came to</TableHead>
    </TableRow></TableHeader>
    <TableBody>{rows.map(r => <TableRow key={`${r.studentId}-${r.date}`}>
      <TableHead scope="row" className="whitespace-normal"><SwimmerName ctx={ctx} id={r.studentId} name={r.name} /><span className="ins-muted block">With us {weeks(r.weeks).toLowerCase()}</span></TableHead>
      <TableCell>{formatDate(parseDateOnly(r.date))}</TableCell>
      <TableCell className="whitespace-normal">{r.reasonKey === "teaching" ? <Flag tone="warn">{r.reason}</Flag> : r.reason}</TableCell>
      <TableCell className="whitespace-normal"><Link href={reportHref(ctx, `/analytics/classes/${r.courseId}`)} className="text-ui-primary hover:underline">{r.levelName}{r.slot ? ` · ${formatSlotShort(r.slot)}` : ""}</Link>{ctx.allSites ? <span className="ins-muted block">{r.siteName}</span> : null}</TableCell>
      <TableCell className="whitespace-normal">{r.teacher ?? <span className="ins-muted">—</span>}</TableCell>
      <TableCell className="ins-num">{r.marked ? `${r.attended} of last ${r.marked}` : <span className="ins-muted">No marks</span>}</TableCell>
    </TableRow>)}</TableBody>
  </Table></div>;
}

export function SwimmersReport({ data }: { data: SwimmerInsights }) {
  const s = data.swimmers;
  const dropOff = s.months.filter(m => m.dropOff !== null);
  return <ReportShell ctx={data} page="swimmers" path="/analytics/swimmers" title="Swimmers" sections={[
    { id: "glance", label: "At a glance" }, { id: "keep", label: "Keep them" }, { id: "growth", label: "Growth" }, { id: "leavers-why", label: "Leavers" }, { id: "families", label: "Families" },
  ]} footnotes={[
    "Joining and leaving count the swim school as a whole: moving class or site, or coming back within two weeks, is not leaving. A leaver is dated the first day without a place.",
    "Came to is the swimmer's last eight marked lessons before leaving. Last taught by is the teacher of the last lesson they came to.",
    "Leave reasons are asked from 16 October 2026; earlier leavers show Not recorded. Finished their class means the place was ended as finished with no other place.",
  ]}>
    <Section id="glance" title="At a glance">
    <KpiStrip label="Swimmers at a glance">
      <Kpi label={`Swimmers ${asOf(data.period)}`} value={formatCount(s.swimmers)} note="Each counted once" />
      <Kpi label="Joined" value={formatCount(s.joined)} note={`${formatCount(s.newSwimmers)} new · ${formatCount(s.returning)} came back`} />
      <Kpi label="Left" value={formatCount(s.left)} note={`${formatCount(s.leaving.length)} more have a last lesson booked`} href="#leavers" />
      <Kpi label="Stayed" value={percent(s.retention.rate)} note={`${formatCount(s.retention.stayed)} of ${formatCount(s.retention.start)} here when the period began`} />
      <Kpi label="Monthly drop-off" value={percent(dropOff.length ? dropOff.reduce((t, m) => t + m.dropOff!, 0) / dropOff.length : null, 1)} spark={s.months.map(m => m.dropOff)} note="Average share leaving each month, last 12 months" />
      <Kpi label="May leave" value={formatCount(s.atRisk.length)} note="Missing lessons lately" href="#at-risk" />
    </KpiStrip>
    </Section>
    <Section id="keep" title="Keep them" intro="Missing lessons lately, or a last lesson already booked. A call now often keeps them.">
    <Panel id="at-risk" title="May leave" sub="Swimmers here now who missed three lessons in a row, or came to under 60% of their last eight. A call now often keeps them.">
      {s.atRisk.length ? <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow><TableHead scope="col">Swimmer</TableHead><TableHead scope="col">Why</TableHead><TableHead scope="col">Class</TableHead><TableHead scope="col">Last came</TableHead><TableHead scope="col">Teacher</TableHead></TableRow></TableHeader>
        <TableBody>{s.atRisk.map(r => <TableRow key={r.studentId}>
          <TableHead scope="row" className="whitespace-normal"><SwimmerName ctx={data} id={r.studentId} name={r.name} /></TableHead>
          <TableCell><div className="ins-flags">{r.reasons.map(x => <Flag key={x} tone="warn">{x}</Flag>)}</div></TableCell>
          <TableCell className="whitespace-normal">{r.courseId ? <Link href={reportHref(data, `/analytics/classes/${r.courseId}`)} className="text-ui-primary hover:underline">{r.className}{r.slot ? ` · ${formatSlotShort(r.slot)}` : ""}</Link> : "—"}</TableCell>
          <TableCell>{r.lastAttended ? formatDate(parseDateOnly(r.lastAttended)) : <span className="ins-muted">Not in the last eight</span>}</TableCell>
          <TableCell>{r.teacher ?? <span className="ins-muted">—</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <EmptyState compact title="Nobody looks likely to leave" hint="No swimmer here now has missed three in a row or most of their recent lessons." />}
    </Panel>
    <Panel id="leaving" title="Leaving soon" sub="A last lesson is booked in.">
      {s.leaving.length ? <LeaverTable ctx={data} rows={s.leaving} upcoming /> : <p className="ins-sub">No last lessons booked.</p>}
    </Panel>
    </Section>
    <Section id="growth" title="Growth" intro="Month by month over the last year, and how long each quarter's new swimmers stay.">
    <Panel id="months" title="Joined and left, month by month" sub="The last 12 months, whatever period is chosen above.">
      <PairedColumns label="Joiners and leavers by month" a="Joined" b="Left" rows={s.months.map(m => ({ key: m.month, label: formatMonth(m.month).slice(0, 3), a: m.joined, b: m.left }))} />
      <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow><TableHead scope="col">Month</TableHead><TableHead scope="col" className="text-right">Swimmers at the end</TableHead><TableHead scope="col" className="text-right">Joined</TableHead><TableHead scope="col" className="text-right">Left</TableHead><TableHead scope="col" className="text-right">Drop-off</TableHead></TableRow></TableHeader>
        <TableBody>{[...s.months].reverse().map(m => <TableRow key={m.month}>
          <TableHead scope="row">{formatMonth(m.month)}</TableHead>
          <TableCell className="ins-num">{formatCount(m.swimmers)}</TableCell>
          <TableCell className="ins-num">{formatCount(m.joined)}</TableCell>
          <TableCell className="ins-num">{formatCount(m.left)}</TableCell>
          <TableCell className="ins-num">{m.dropOff !== null && m.dropOff > 3 ? <Flag tone="warn">{percent(m.dropOff, 1)}</Flag> : percent(m.dropOff, 1)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </Panel>
    <Panel id="stay" title="How long new swimmers stay" sub="Of the new swimmers who joined in each quarter, the share still swimming after each number of weeks. Each figure counts only those who joined long enough ago; a blank means nobody has yet. The top row is everyone who joined in the last two years.">
      <div className="ins-table-wrap"><Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Joined</TableHead>
          <TableHead scope="col" className="text-right">New swimmers</TableHead>
          {data.stay.milestones.map(w => <TableHead key={w} scope="col" className="text-right">{w === 52 ? "1 year" : `${w} weeks`}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          <TableRow><TableHead scope="row" className="font-semibold">Last two years</TableHead><TableCell className="ins-num">—</TableCell>{data.stay.overall.map((v, i) => <TableCell key={i} className="ins-num"><Meter value={v} /></TableCell>)}</TableRow>
          {[...data.stay.cohorts].reverse().map(c => <TableRow key={c.key}>
            <TableHead scope="row">{c.label}</TableHead>
            <TableCell className="ins-num">{formatCount(c.joined)}</TableCell>
            {c.values.map((v, i) => <TableCell key={i} className="ins-num">{v === null ? <span className="ins-muted">—</span> : <Meter value={v} tone={data.stay.overall[i] !== null && v < data.stay.overall[i]! - 10 ? "warn" : undefined} />}</TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table></div>
    </Panel>
    </Section>
    <Section id="leavers-why" title="Leavers" intro="Reasons from the unenrol form, how long leavers were with us and the level they left from.">
        <Panel span={4} id="reasons" title="Why they left" sub={`${plural(s.left, "leaver")} in the period.`}>
        {s.reasons.length ? <Bars label="Leavers by reason" rows={s.reasons.map(r => ({ key: r.key, label: r.label, value: r.count, tone: r.key === "teaching" || r.key === "progress" ? "warn" as const : undefined }))} /> : <p className="ins-sub">Nobody left.</p>}
      </Panel>
        <Panel span={4} id="tenure" title="How long they stayed" sub="Time with the swim school before leaving.">
        <Bars label="Leavers by time with us" rows={s.tenure.map(t => ({ key: t.label, label: t.label, value: t.count }))} />
      </Panel>
        <Panel span={4} id="by-level" title="The level they left from" sub="Level of their last place.">
        {s.byLevel.length ? <Bars label="Leavers by level" rows={s.byLevel.map(l => ({ key: `${l.programmeName}-${l.name}`, label: `${l.name}${l.programmeName ? ` · ${l.programmeName}` : ""}`, value: l.count }))} /> : <p className="ins-sub">Nobody left.</p>}
      </Panel>
    <Panel id="leavers" title="Every leaver" sub="Newest first.">
      {s.leavers.length ? <LeaverTable ctx={data} rows={s.leavers} /> : <EmptyState compact title="Nobody left in this period" />}
    </Panel>
    </Section>
    <Section id="families" title="Families" intro="Parents using the app, and the ages we teach.">
        <Panel span={5} id="parents" title="Parents in the app" sub="Swimmers here today with a parent linked in the parents app, where they book, see progress and ask for changes.">
        <Attention items={[
          { key: "linked", count: data.parents.linked, title: `${percent(data.parents.share)} of swimmers linked`, hint: `Of ${plural(data.parents.swimmers, "swimmer")} here today` },
          { key: "not", count: data.parents.swimmers - data.parents.linked, title: "No parent in the app", hint: "Worth a mention at the desk", tone: "warn" },
          { key: "new", count: data.parents.newLinks, title: "Linked in this period", hint: "Swimmers here today first linked in the period" },
        ]} />
      </Panel>
        <Panel span={7} id="ages" title="Swimmers by age" sub={`Swimmers here ${asOf(data.period, "today")}.`}>
        <ColumnChart label="Swimmers by age" rows={s.ages.bands.map(b => ({ key: b.label, tick: b.label, short: b.label.replace(" to ", "–").replace(" and over", "+"), value: b.count }))} />
      </Panel>
    </Section>
  </ReportShell>;
}
