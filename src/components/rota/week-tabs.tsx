import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { formatDayMonth, formatWeekday } from "@/lib/format";
import type { RotaDay } from "@/lib/rota/data";
import { dayNeedsFor } from "@/lib/rota/planner";

/** The week's days as tabs, each counting what still needs sorting out for the department shown
 *  (places with nobody, people off or unqualified, double-bookings, cover gaps), so a supervisor
 *  sees which days to open. The Week plan adds its whole-week tab first. */
export function WeekTabs({ days, current, today, departmentId, href, week }: {
  days: readonly RotaDay[];
  /** The day shown, or null for the whole week. */
  current: string | null;
  today: string;
  departmentId: string | null;
  href: (day: string | null) => string;
  /** The whole-week tab's label, when the page has one. */
  week?: string;
}) {
  const items = days.map((d) => {
    const count = dayNeedsFor(d.shifts, d.planned, departmentId).needs.length;
    return {
      // The count is a small amber mark beside the date, and says what it counts to a screen reader.
      href: href(d.iso), current: d.iso === current,
      count: count ? <span className="rota-tab-count">{count}<span className="sr-only"> to sort out</span></span> : undefined,
      label: <>{d.iso === today ? "Today" : formatWeekday(d.iso, "short")}<span className="pc-only-wide font-normal">&nbsp;{formatDayMonth(d.iso)}</span><span className="pc-only-narrow sr-only"> {formatDayMonth(d.iso)}</span></>,
    };
  });
  return <SegmentedLinks label="Days of the week" items={week ? [{ href: href(null), current: current === null, label: week }, ...items] : items} />;
}
