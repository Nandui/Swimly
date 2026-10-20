import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatTime, plural } from "@/lib/format";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import type { BusinessInsights, PoolDeckInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { HeatLegend, percent } from "@/modules/activities/features/analytics/components/insights/kit";

type Day = keyof typeof DAY_META;

function band(fill: number | null) {
  if (fill === null) return undefined;
  return fill >= 100 ? "4" : fill >= 80 ? "3" : fill >= 50 ? "2" : "1";
}
/** Attendance shading: the weaker the slot, the lighter. */
function attendanceBand(rate: number | null) {
  if (rate === null) return undefined;
  return rate >= 92 ? "4" : rate >= 85 ? "3" : rate >= 75 ? "2" : "1";
}

/** Places filled by day and start hour, an orange dot where someone waits for that slot. */
export function TimetableHeat({ capacity }: { capacity: Pick<BusinessInsights["capacity"], "heat" | "days"> }) {
  if (!capacity.heat.length) return <p className="ins-sub">No weekly classes at this site.</p>;
  return <>
    <div className="ins-heat-wrap">
      <Table className="ins-heat" data-layout="grid">
        <TableCaption className="sr-only">Places filled by day and start hour</TableCaption>
        <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{capacity.days.map(day => <TableHead key={day} scope="col">{DAY_META[day as Day].short}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{capacity.heat.map(row => <TableRow key={row.hour}>
          <TableHead scope="row">{formatTime(row.hour * 60)}</TableHead>
          {row.cells.map(cell => cell.classes === 0 ? <TableCell key={cell.day} data-empty=""><span className="sr-only">No classes</span></TableCell> : <TableCell key={cell.day} data-band={band(cell.fill)} data-waiting={cell.waiting ? "" : undefined} title={`${DAY_META[cell.day as Day].label} ${formatTime(row.hour * 60)}: ${plural(cell.classes, "class", "classes")}, ${cell.enrolled} enrolled${cell.capacity ? ` of ${cell.capacity}` : ""}${cell.waiting ? `, ${cell.waiting} waiting` : ""}`}>
            {cell.waiting ? <i className="ins-heat-dot" aria-hidden="true" /> : null}<strong>{percent(cell.fill)}</strong><span>{cell.enrolled}{cell.capacity ? ` of ${cell.capacity}` : ""}{cell.waiting ? `, ${cell.waiting} waiting` : ""}</span>
          </TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
    </div>
    <HeatLegend low="Under half full" high="Full" waiting="Someone waiting" />
  </>;
}

/** The share of swimmers who came, by day and start hour. */
export function AttendanceHeat({ slots }: { slots: PoolDeckInsights["slots"] }) {
  if (!slots.heat.length) return <p className="ins-sub">No registers taken in this period.</p>;
  return <>
    <div className="ins-heat-wrap">
      <Table className="ins-heat" data-layout="grid">
        <TableCaption className="sr-only">Attendance by day and start hour</TableCaption>
        <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{slots.days.map(day => <TableHead key={day} scope="col">{DAY_META[day as Day].short}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{slots.heat.map(row => <TableRow key={row.hour}>
          <TableHead scope="row">{formatTime(row.hour * 60)}</TableHead>
          {row.cells.map(cell => cell.lessons === 0 ? <TableCell key={cell.day} data-empty=""><span className="sr-only">No lessons</span></TableCell> : <TableCell key={cell.day} data-band={attendanceBand(cell.rate)} title={`${DAY_META[cell.day as Day].label} ${formatTime(row.hour * 60)}: ${percent(cell.rate)} attendance over ${plural(cell.lessons, "lesson")}`}>
            <strong>{percent(cell.rate)}</strong><span>{plural(cell.lessons, "lesson")}</span>
          </TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
    </div>
    <HeatLegend low="Under 75% came" high="92% or more" />
  </>;
}
