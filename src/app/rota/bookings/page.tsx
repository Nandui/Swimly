import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { BookingDialog, CancelBooking } from "@/components/rota/bookings";
import { formatDate, formatTimeRange, plural, today } from "@/lib/format";
import { BOOKING_KIND_META, WEEKDAY_LABELS, type BookingKind } from "@/lib/rota/constants";
import { rotaRepeats } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Bookings" };

const day = (date: Date) => formatDate(new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`));
/** "Mon to Fri", "Tue, Thu", "Saturdays". */
function weekdays(list: number[]) {
  const sorted = [...list].sort();
  const short = sorted.map((d) => WEEKDAY_LABELS[d].slice(0, 3));
  if (sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)) return `${short[0]} to ${short.at(-1)}`;
  return sorted.length === 1 ? `${WEEKDAY_LABELS[sorted[0]]}s` : short.join(", ");
}

/** Bookings that repeat over weeks at one site (owner decision, 6 October 2026): each adds its
 *  activity on its days, planned on the Plan like any other. */
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaRepeats((await searchParams).site);
  const { site } = data;
  const now = today();
  const places = [...new Set(data.repeats.map((r) => r.place).filter(Boolean))];
  return (
    <>
      <PageHeader title={site ? `Bookings: ${site.name}` : "Bookings"}
        description="Schools, parties and lane hire that repeat over weeks. Each adds its activity on its days, ready to plan who."
        actions={site?.plan && data.types.length ? <BookingDialog siteId={site.id} today={now} types={data.types} places={places} /> : undefined} />
      {data.repeats.length === 0 ? (
        <EmptyState icon="calendarRange" title="No bookings yet" hint="When a school, a party or a club books time that needs staff, add it here." />
      ) : (
        <section aria-label="Bookings" className="pc-panel">
          <ul className="pc-rows">
            {data.repeats.map((b) => {
              const toCome = b.needs.reduce((n, x) => n + x.places, 0);
              const filled = b.needs.reduce((n, x) => n + Math.min(x._count.assignments, x.places), 0);
              const first = b.firstDay.toISOString().slice(0, 10);
              return (
                <li key={b.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="flex flex-wrap items-center gap-2"><span className="pc-row-title">{b.title}</span><Tag meta={BOOKING_KIND_META[b.kind as BookingKind]} /></span>
                    <span className="pc-row-hint">{weekdays(b.weekdays)}, {formatTimeRange(b.startMinutes, b.endMinutes)} · {b.firstDay.getTime() === b.lastDay.getTime() ? day(b.firstDay) : `${day(b.firstDay)} to ${day(b.lastDay)}`}{b.place ? ` · ${b.place}` : ""}</span>
                    <span className="pc-row-hint">{b.type.name}, {plural(b.places, "person", "people")} each day · {b.needs.length ? `${plural(b.needs.length, "day")} to come, ${toCome - filled ? `${plural(toCome - filled, "place")} still to fill` : "all filled"}` : "no days still to come"}</span>
                  </span>
                  <span className="pc-row-trail">
                    {site?.plan && b.needs.length ? <CancelBooking id={b.id} label={b.title} /> : null}
                    <Button asChild variant="outline"><Link href={`/rota?${new URLSearchParams({ site: site!.id, dept: b.type.departmentId, day: first > now ? first : now })}`}><CalendarDays aria-hidden="true" />Plan who</Link></Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
