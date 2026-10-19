import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatTime } from "@/lib/format";
import { HeatLegend } from "@/modules/activities/features/analytics/components/insights/kit";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from "@/modules/activities/shared/enrolment/follow-up";

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** A wait in words: minutes under an hour, hours under two days, then days. */
export function duration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${whole.format(minutes)} min`;
  if (minutes < 48 * 60) return `${one.format(minutes / 60)} h`;
  return `${one.format(minutes / 1440)} days`;
}

export const outcomeLabel = (key: string) => CONTACT_OUTCOMES[key as keyof typeof CONTACT_OUTCOMES]?.label ?? key;
export const channelLabel = (key: string) => CONTACT_CHANNELS[key as keyof typeof CONTACT_CHANNELS] ?? key;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type HeatRow = { hour: number; cells: { day: number; count: number; share: number }[] };

function band(share: number) {
  return share >= 0.75 ? "4" : share >= 0.45 ? "3" : share >= 0.2 ? "2" : "1";
}

/** When the work was done: day of the week across, hour of the day down, darker for more. */
export function BusyHours({ rows, caption }: { rows: HeatRow[]; caption: string }) {
  if (!rows.length) return <p className="ins-sub">Nothing recorded in this period.</p>;
  return <div className="ins-heat-wrap">
    <Table className="ins-heat" data-layout="grid">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{DAYS.map(day => <TableHead key={day} scope="col">{day}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.hour}>
        <TableHead scope="row">{formatTime(row.hour * 60)}</TableHead>
        {row.cells.map(cell => cell.count === 0
          ? <TableCell key={cell.day} data-empty=""><span className="sr-only">None</span></TableCell>
          : <TableCell key={cell.day} data-band={band(cell.share)} title={`${LONG_DAYS[cell.day]} ${formatTime(row.hour * 60)}: ${cell.count} actions`}><strong>{cell.count}</strong></TableCell>)}
      </TableRow>)}</TableBody>
    </Table>
    <HeatLegend low="Quiet" high="Busiest" />
  </div>;
}

/** One figure beside the team's, as two bars to one scale. */
export function Versus({ label, mine, team, format, lowerBetter, who = "This person" }: {
  label: string; mine: number | null; team: number | null; format: (n: number | null) => string; lowerBetter?: boolean; who?: string;
}) {
  const max = Math.max(1, mine ?? 0, team ?? 0);
  const gap = team !== null && mine !== null ? (lowerBetter ? mine - team : team - mine) : null;
  const worse = gap !== null && team !== null && gap > Math.max(10, Math.abs(team) * 0.25);
  return <li>
    <span className="ins-kpi-label">{label}</span>
    <span className="ins-compare-line"><span>{who}</span><span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" style={{ width: `${(mine ?? 0) / max * 100}%` }} /></span><strong className="ins-num">{format(mine)}</strong></span>
    <span className="ins-compare-line" data-who="school"><span>Team</span><span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" style={{ width: `${(team ?? 0) / max * 100}%` }} /></span><span className="ins-num">{format(team)}</span></span>
    {worse ? <span className="ins-flag" data-tone="warn">Worse than the team</span> : null}
  </li>;
}
