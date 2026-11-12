import { formatCount, formatDayMonth, plural } from "@/lib/format";
import type { ClassesInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { ClassTable } from "@/modules/activities/features/analytics/components/insights/class-table";
import { asOf, filterQuery, Kpi, KpiStrip, Panel, percent, ReportShell } from "@/modules/activities/features/analytics/components/insights/kit";

/** Every class, behind the business dashboard: sort, search and open one. The timetable, levels and
 *  the coming weeks are on the dashboard itself; attendance by slot and cancellations on the pool deck. */
export function ClassesReport({ data }: { data: ClassesInsights }) {
  const c = data.classes;
  const held = c.rows.reduce((s, r) => s + r.lessons, 0);
  const marked = c.rows.filter(r => r.attendance !== null);
  const now = asOf(data.period, "today");
  return <ReportShell ctx={data} page="classes" path="/analytics/classes" title="Every class" back footnotes={[
    `Places are as of ${data.period.current ? "today" : formatDayMonth(data.period.end)}; waiting lists are always as of today. Attendance, joiners and leavers are for the period. Moved on means moved to another class or finished the class.`,
  ]}>
    <KpiStrip label="Classes at a glance">
      <Kpi label={`Places filled ${now}`} value={percent(c.totals.rate)} meter={c.totals.rate} note={`${formatCount(c.totals.enrolled)} of ${formatCount(c.totals.capacity)} places`} />
      <Kpi label="Free places" value={formatCount(c.totals.empty)} note={`Across ${plural(c.rows.length, "weekly class", "weekly classes")}`} />
      <Kpi label="Waiting list" value={formatCount(c.waiting)} note={`In ${plural(c.rows.filter(r => r.waiting).length, "class", "classes")}`} />
      <Kpi label="Lessons held" value={formatCount(held)} note={`Average attendance ${percent(marked.length ? marked.reduce((s, r) => s + r.attendance!, 0) / marked.length : null)} per class`} />
    </KpiStrip>
    <Panel id="classes" title="Every class" sub="Open a class for its swimmers, its waiting list and every lesson with who taught it.">
      <ClassTable rows={c.rows} showSite={data.allSites} query={filterQuery(data)} />
    </Panel>
  </ReportShell>;
}
