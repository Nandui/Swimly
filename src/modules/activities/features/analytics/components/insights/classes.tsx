import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, formatTime, plural } from "@/lib/format";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import type { ClassesInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { ClassTable } from "@/modules/activities/features/analytics/components/insights/class-table";
import { Kpi, Meter, Panel, percent, ReportShell, scopeOf } from "@/modules/activities/features/analytics/components/insights/kit";
import { reportQuery, type RangeKey } from "@/modules/activities/features/analytics/server/period";

function band(fill: number | null) {
  if (fill === null) return undefined;
  return fill >= 100 ? "4" : fill >= 80 ? "3" : fill >= 50 ? "2" : "1";
}

export function ClassesReport({ data }: { data: ClassesInsights }) {
  const c = data.classes;
  const held = c.rows.reduce((s, r) => s + r.lessons, 0);
  const marked = c.rows.filter(r => r.attendance !== null);
  const query = reportQuery(data.period.key as RangeKey, scopeOf(data));
  return <ReportShell ctx={data} page="classes" path="/analytics/classes" title="Classes" footnotes={[
    "Places and waiting lists are as of today. Attendance, joiners and leavers are for the period. Moved on means moved to another class or finished the class.",
  ]}>
    <ul className="ins-kpis" aria-label="Classes at a glance">
      <Kpi label="Places filled" value={percent(c.totals.rate)} note={`${formatCount(c.totals.enrolled)} of ${formatCount(c.totals.capacity)} places`} />
      <Kpi label="Free places" value={formatCount(c.totals.empty)} note={`Across ${plural(c.rows.length, "weekly class", "weekly classes")}`} />
      <Kpi label="Waiting list" value={formatCount(c.waiting)} note={`In ${plural(c.rows.filter(r => r.waiting).length, "class", "classes")}`} />
      <Kpi label="Lessons held" value={formatCount(held)} note={`Average attendance ${percent(marked.length ? marked.reduce((s, r) => s + r.attendance!, 0) / marked.length : null)} per class`} />
    </ul>
    <Panel id="timetable" title="Where the timetable is full" sub="Places filled by day and start time. A gold edge means someone is waiting for a class in that slot.">
      {c.heat.length ? <div className="ins-heat-wrap">
        <Table className="ins-heat" data-layout="grid">
          <TableCaption className="sr-only">Places filled by day and start hour</TableCaption>
          <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{c.days.map(day => <TableHead key={day} scope="col">{DAY_META[day].short}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{c.heat.map(row => <TableRow key={row.hour}>
            <TableHead scope="row">{formatTime(row.hour * 60)}</TableHead>
            {row.cells.map(cell => cell.classes === 0 ? <TableCell key={cell.day} data-empty=""><span className="sr-only">No classes</span></TableCell> : <TableCell key={cell.day} data-band={band(cell.fill)} data-waiting={cell.waiting ? "" : undefined} title={`${DAY_META[cell.day].label} ${formatTime(row.hour * 60)}: ${plural(cell.classes, "class", "classes")}, ${cell.enrolled} enrolled${cell.capacity ? ` of ${cell.capacity}` : ""}${cell.waiting ? `, ${cell.waiting} waiting` : ""}`}>
              <strong>{percent(cell.fill)}</strong><span>{cell.enrolled}{cell.capacity ? `/${cell.capacity}` : ""}{cell.waiting ? ` · ${cell.waiting} waiting` : ""}</span>
            </TableCell>)}
          </TableRow>)}</TableBody>
        </Table>
      </div> : <p className="ins-sub">No weekly classes at this site.</p>}
    </Panel>
    <Panel id="levels" title="Each level" sub="Where swimmers wait and where places sit empty, level by level.">
      <div className="ins-table-wrap">
        <Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Level</TableHead>
            <TableHead scope="col" className="text-right">Classes</TableHead>
            <TableHead scope="col" className="text-right">Filled</TableHead>
            <TableHead scope="col" className="text-right">Free</TableHead>
            <TableHead scope="col" className="text-right">Waiting</TableHead>
          </TableRow></TableHeader>
          <TableBody>{c.levels.map(l => <TableRow key={l.levelId}>
            <TableHead scope="row" className="whitespace-normal"><span className="font-semibold">{l.name}</span><span className="ins-muted block">{l.programmeName}</span></TableHead>
            <TableCell className="ins-num">{l.classes}</TableCell>
            <TableCell className="ins-num"><span className="block">{l.enrolled} of {l.capacity}</span><Meter value={l.fill} /></TableCell>
            <TableCell className="ins-num">{l.empty}</TableCell>
            <TableCell className="ins-num">{l.waiting ? <span className="font-semibold">{l.waiting}</span> : <span className="ins-muted">0</span>}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    </Panel>
    <Panel id="classes" title="Every class" sub="Open a class for its swimmers, its waiting list and every lesson with who taught it.">
      <ClassTable rows={c.rows} showSite={data.allSites} query={query} />
    </Panel>
  </ReportShell>;
}
