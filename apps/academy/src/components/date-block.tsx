import { dateBlock } from "@/lib/format";

/** The parents app's ticket date: the month on orange over a large day. Decorative beside the
 *  written date, so screen readers skip it. */
export function DateBlock({ date, quiet }: { date: string | null; quiet?: boolean }) {
  if (!date) return null;
  const { month, day } = dateBlock(date);
  return (
    <span className="ticket-date" data-quiet={quiet ? "" : undefined} aria-hidden="true">
      <span className="ticket-month">{month}</span>
      <span className="ticket-day">{day}</span>
    </span>
  );
}
