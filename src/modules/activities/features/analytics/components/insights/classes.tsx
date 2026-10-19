import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import Link from "next/link";
import { formatCount, formatDayMonth, formatTime, plural } from "@/lib/format";
import { DAY_META, formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { ClassesInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { ClassTable } from "@/modules/activities/features/analytics/components/insights/class-table";
import { asOf, Bars, filterQuery, HeatLegend, Kpi, KpiStrip, Meter, Panel, percent, ReportShell, reportHref, Section } from "@/modules/activities/features/analytics/components/insights/kit";

function band(fill: number | null) {
  if (fill === null) return undefined;
  return fill >= 100 ? "4" : fill >= 80 ? "3" : fill >= 50 ? "2" : "1";
}
/** Attendance shading: the weaker the slot, the lighter. */
function attendanceBand(rate: number | null) {
  if (rate === null) return undefined;
  return rate >= 92 ? "4" : rate >= 85 ? "3" : rate >= 75 ? "2" : "1";
}

export function ClassesReport({ data }: { data: ClassesInsights }) {
  const c = data.classes;
  const held = c.rows.reduce((s, r) => s + r.lessons, 0);
  const marked = c.rows.filter(r => r.attendance !== null);
  const query = filterQuery(data);
  const now = asOf(data.period, "today");
  return <ReportShell ctx={data} page="classes" path="/analytics/classes" title="Classes" sections={[
    { id: "glance", label: "At a glance" }, { id: "capacity", label: "Capacity" }, { id: "delivery", label: "Lessons" }, { id: "all-classes", label: "Every class" },
  ]} footnotes={[
    `Places are as of ${data.period.current ? "today" : formatDayMonth(data.period.end)}; waiting lists and the next four weeks are always as of today. Attendance, joiners and leavers are for the period. Moved on means moved to another class or finished the class.`,
  ]}>
    <Section id="glance" title="At a glance">
    <KpiStrip label="Classes at a glance">
      <Kpi label={`Places filled ${now}`} value={percent(c.totals.rate)} note={`${formatCount(c.totals.enrolled)} of ${formatCount(c.totals.capacity)} places`} />
      <Kpi label="Free places" value={formatCount(c.totals.empty)} note={`Across ${plural(c.rows.length, "weekly class", "weekly classes")}`} />
      <Kpi label="Waiting list" value={formatCount(c.waiting)} note={`In ${plural(c.rows.filter(r => r.waiting).length, "class", "classes")}`} />
      <Kpi label="Lessons held" value={formatCount(held)} note={`Average attendance ${percent(marked.length ? marked.reduce((s, r) => s + r.attendance!, 0) / marked.length : null)} per class`} />
    </KpiStrip>
    </Section>
    <Section id="capacity" title="Capacity" intro={`The timetable ${now}, each level's places and waiting list, and the places already booked for the coming weeks.`}>
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
      {c.heat.length ? <HeatLegend low="Under half full" high="Full" waiting="Someone waiting" /> : null}
    </Panel>
    <Panel span={6} id="levels" title="Each level" sub="Where swimmers wait and where places sit empty, level by level.">
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
    <Panel span={6} id="forecast" title="The next four weeks" sub={`From today, whatever the period. Places already booked on each coming week, with the places starting and ending in between. New joiners are not guessed. ${plural(data.forecast.waiting, "swimmer is", "swimmers are")} on a waiting list.`}>
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
    <Section id="delivery" title="Lessons" intro="Who came, which lessons were cancelled, and whether swimmers kept the same teacher.">
    <Panel id="slots" title="Attendance by time slot" sub="The share of swimmers who came, by day and start time, across the lessons held in the period. Lighter slots lose more swimmers to absence.">
      {data.slots.heat.length ? <div className="ins-heat-wrap">
        <Table className="ins-heat" data-layout="grid">
          <TableCaption className="sr-only">Attendance by day and start hour</TableCaption>
          <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{data.slots.days.map(day => <TableHead key={day} scope="col">{DAY_META[day].short}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{data.slots.heat.map(row => <TableRow key={row.hour}>
            <TableHead scope="row">{formatTime(row.hour * 60)}</TableHead>
            {row.cells.map(cell => cell.lessons === 0 ? <TableCell key={cell.day} data-empty=""><span className="sr-only">No lessons</span></TableCell> : <TableCell key={cell.day} data-band={attendanceBand(cell.rate)} title={`${DAY_META[cell.day].label} ${formatTime(row.hour * 60)}: ${percent(cell.rate)} attendance over ${plural(cell.lessons, "lesson")}`}>
              <strong>{percent(cell.rate)}</strong><span>{plural(cell.lessons, "lesson")}</span>
            </TableCell>)}
          </TableRow>)}</TableBody>
        </Table>
      </div> : <p className="ins-sub">No registers taken in this period.</p>}
      {data.slots.heat.length ? <HeatLegend low="Under 75% came" high="92% or more" /> : null}
    </Panel>
      <Panel span={5} id="cancelled" title="Cancelled lessons" sub={`${plural(data.cancellations.lessons, "lesson")} cancelled (${percent(data.cancellations.share, 1)} of those timetabled), affecting ${plural(data.cancellations.swimmers, "swimmer place", "swimmer places")}. ${formatCount(data.cancellations.previous)} in the period before.`}>
        {data.cancellations.reasons.length ? <Bars label="Cancelled lessons by reason" rows={data.cancellations.reasons.map(r => ({ key: r.key, label: r.key, value: r.count }))} /> : <p className="ins-sub">No lessons were cancelled.</p>}
      </Panel>
      <Panel span={7} id="continuity" title="Same teacher each week" sub={`${percent(data.continuity.school)} of lessons were taught by the class's usual teacher. Classes with the most changes first.`}>
        {data.continuity.classes.length ? <ul className="pc-rows">{data.continuity.classes.slice(0, 6).map(k => <li key={k.courseId} className="pc-row"><div className="pc-row-body">
          <p className="pc-row-title">{k.course ? <Link href={reportHref(data, `/analytics/classes/${k.courseId}`)} className="text-ui-primary hover:underline">{k.course.name} · {formatSlotShort(k.course.slot)}</Link> : "Class removed"}</p>
          <p className="pc-row-hint">{data.allSites && k.course ? `${k.course.siteName} · ` : ""}{plural(k.teachers, "teacher")} over {plural(k.lessons, "lesson")} · usually {k.main}</p>
        </div><div className="pc-row-trail"><Meter value={k.share} tone={k.share < 75 ? "warn" : undefined} /></div></li>)}</ul> : <p className="ins-sub">No lessons started in this period.</p>}
      </Panel>
    </Section>
    <Section id="all-classes" title="Every class" intro="Sort, search and open any class.">
    <Panel id="classes" title="Every class" sub="Open a class for its swimmers, its waiting list and every lesson with who taught it.">
      <ClassTable rows={c.rows} showSite={data.allSites} query={query} />
    </Panel>
    </Section>
  </ReportShell>;
}
