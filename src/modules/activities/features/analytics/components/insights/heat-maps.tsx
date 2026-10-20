import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatTime, plural } from "@/lib/format";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import type { PoolDeckInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { HeatLegend, percent } from "@/modules/activities/features/analytics/components/insights/kit";

type Day = keyof typeof DAY_META;

/** Attendance shading: the weaker the slot, the lighter. */
function attendanceBand(rate: number | null) {
  if (rate === null) return undefined;
  return rate >= 92 ? "4" : rate >= 85 ? "3" : rate >= 75 ? "2" : "1";
}

/** The share of swimmers who came, by day and class start time. */
export function AttendanceHeat({ slots }: { slots: PoolDeckInsights["slots"] }) {
  if (!slots.heat.length) return <p className="ins-sub">No registers taken in this period.</p>;
  return <>
    <div className="ins-heat-wrap">
      <Table className="ins-heat" data-layout="grid">
        <TableCaption className="sr-only">Attendance by day and start time</TableCaption>
        <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{slots.days.map(day => <TableHead key={day} scope="col">{DAY_META[day as Day].short}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{slots.heat.map(row => <TableRow key={row.start}>
          <TableHead scope="row">{formatTime(row.start)}</TableHead>
          {row.cells.map(cell => cell.lessons === 0 ? <TableCell key={cell.day} data-empty=""><span className="sr-only">No lessons</span></TableCell> : <TableCell key={cell.day} data-band={attendanceBand(cell.rate)} title={`${DAY_META[cell.day as Day].label} ${formatTime(row.start)}: ${percent(cell.rate)} attendance over ${plural(cell.lessons, "lesson")}`}>
            <strong>{percent(cell.rate)}</strong><span>{plural(cell.lessons, "lesson")}</span>
          </TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
    </div>
    <HeatLegend low="Under 75% came" high="92% or more" />
  </>;
}
