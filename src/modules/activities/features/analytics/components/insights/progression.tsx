import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { formatCount, plural } from "@/lib/format";
import type { ProgressionInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { asOf, Bars, Flag, Kpi, KpiStrip, Meter, Panel, percent, ReportShell, Section, weeks } from "@/modules/activities/features/analytics/components/insights/kit";

export function ProgressionReport({ data }: { data: ProgressionInsights }) {
  const p = data.progression;
  const a = p.assessments;
  const groups = [...new Set(p.levels.map(l => l.programmeName))];
  const timed = p.levels.filter(l => l.medianWeeks !== null);
  return <ReportShell ctx={data} page="progression" path="/analytics/progression" title="Progression" sections={[
    { id: "glance", label: "At a glance" }, { id: "pace", label: "Pace" }, { id: "levels", label: "Level by level" },
  ]} footnotes={[
    "Weeks to pass runs from a swimmer's first place at the level to the day the level was completed. The middle value is shown, so one slow or fast swimmer does not skew it.",
    "Over 6 months counts swimmers here now who have been at their level more than 26 weeks. Hardest skill is the one the fewest swimmers at the level have, with at least three swimmers.",
    "Booked to a place counts swimmers assessed in the period who started a class within 30 days. Assessment sessions are not tied to a programme, so with a programme chosen only bookings placed elsewhere are left out.",
  ]}>
    <Section id="glance" eyebrow="At a glance" title="Passing levels and starting classes">
    <KpiStrip label="Progression at a glance">
      <Kpi label="Level passes" value={formatCount(p.passes)} note="Levels completed in the period" />
      <Kpi label="Over 6 months at a level" value={formatCount(p.stuck)} note={`Swimmers here ${asOf(data.period)}`} />
      <Kpi label="Assessed" value={formatCount(a.attended)} note={`${formatCount(a.sessions)} sessions · ${formatCount(a.noShow)} no-shows`} />
      <Kpi label="Booked to a place" value={percent(a.conversion)} note={`${formatCount(a.converted)} of ${formatCount(a.attended)} assessed started a class`} />
      <Kpi label="Assessment to first lesson" value={a.daysToClass !== null ? `${formatCount(a.daysToClass)}` : "—"} unit={a.daysToClass !== null ? (a.daysToClass === 1 ? " day" : " days") : undefined} note="Typical wait for those who started within two months" />
    </KpiStrip>
    </Section>
    <Section id="pace" eyebrow="Pace" title="How fast swimmers move up" intro="The middle swimmer's time to pass each level, and how assessments turn into places.">
    <div className="ins-grid ins-even">
      <Panel id="pass-time" title="Weeks to pass each level" sub="The middle swimmer's time, for levels passed in the period.">
        {timed.length ? <Bars label="Weeks to pass by level" format={n => `${Math.round(n)} wk`} rows={timed.map(l => ({ key: l.levelId, label: `${l.name}${groups.length > 1 ? ` · ${l.programmeName}` : ""}`, value: l.medianWeeks!, tone: l.medianWeeks! > 26 ? "warn" as const : undefined }))} /> : <p className="ins-sub">No level passes in this period.</p>}
      </Panel>
      <Panel id="assessments" title="Assessments" sub="New swimmer and level assessments in the period.">
        <Bars label="Assessment bookings" rows={[
          { key: "attended", label: "Assessed", value: a.attended },
          { key: "placed", label: "Given a level", value: a.placed },
          { key: "converted", label: "Started a class", value: a.converted },
          { key: "noshow", label: "Did not come", value: a.noShow, tone: "warn" as const },
          { key: "cancelled", label: "Cancelled", value: a.cancelled },
          { key: "upcoming", label: "Still booked", value: a.upcoming },
        ]} />
      </Panel>
    </div>
    </Section>
    <Section id="levels" eyebrow="Level by level" title="Each programme's levels" intro="Swimmers at each level now, passes in the period, skills done and the skill that holds them back.">
    {groups.length === 0 ? <EmptyState title="No levels to show" hint="Levels appear once swimmers are in classes at this site." /> : null}
    {groups.map(group => {
      const levels = p.levels.filter(l => l.programmeName === group);
      return <Panel key={group} id={`programme-${group}`} title={group || "Levels"} sub="Each level now, and how quickly swimmers pass it.">
        <div className="ins-table-wrap"><Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Level</TableHead>
            <TableHead scope="col" className="text-right">Swimmers</TableHead>
            <TableHead scope="col" className="text-right">Passed</TableHead>
            <TableHead scope="col" className="text-right">Weeks to pass</TableHead>
            <TableHead scope="col" className="text-right">Skills done</TableHead>
            <TableHead scope="col">Hardest skill</TableHead>
            <TableHead scope="col" className="text-right">Over 6 months</TableHead>
          </TableRow></TableHeader>
          <TableBody>{levels.map(l => <TableRow key={l.levelId}>
            <TableHead scope="row" className="whitespace-normal"><span className="font-semibold">{l.name}</span>{l.waiting ? <span className="ins-muted block">{l.waiting} waiting</span> : null}</TableHead>
            <TableCell className="ins-num">{formatCount(l.swimmers)}<span className="ins-muted block">{l.averageWeeks !== null ? `${weeks(l.averageWeeks)} on average` : ""}</span></TableCell>
            <TableCell className="ins-num">{formatCount(l.passes)}</TableCell>
            <TableCell className="ins-num">{l.medianWeeks !== null ? Math.round(l.medianWeeks) : <span className="ins-muted">—</span>}</TableCell>
            <TableCell className="ins-num"><Meter value={l.skillsDone} /><span className="ins-muted block">{plural(l.skills, "skill")}</span></TableCell>
            <TableCell className="whitespace-normal">{l.hardest ? <>{l.hardest.name}<span className="ins-muted block">{percent(l.hardest.achieved)} have it</span></> : <span className="ins-muted">—</span>}</TableCell>
            <TableCell className="ins-num">{l.stuck ? <Flag tone="warn">{l.stuck}</Flag> : <span className="ins-muted">0</span>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
      </Panel>;
    })}
    </Section>
  </ReportShell>;
}
