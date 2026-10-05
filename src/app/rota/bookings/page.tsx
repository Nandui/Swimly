import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Button } from "@/components/shadcn/button";
import { BookingDialog, CancelBooking } from "@/components/rota/bookings";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatTimeRange, plural } from "@/lib/format";
import { BOOKING_KIND_META, WEEKDAY_LABELS, qualificationShort, type BookingKind } from "@/lib/rota/constants";
import { rotaBookings } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Bookings" };

const day = (date: Date) => formatDate(new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`));
/** "Mon to Fri", "Tue, Thu", "Saturdays". */
function weekdays(list: number[]) {
  const sorted = [...list].sort();
  const short = sorted.map((d) => WEEKDAY_LABELS[d].slice(0, 3));
  if (sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)) return `${short[0]} to ${short.at(-1)}`;
  return sorted.length === 1 ? `${WEEKDAY_LABELS[sorted[0]]}s` : short.join(", ");
}

/** "2 swim teachers and 1 lifeguard (NPLQ)": the qualification only when it
 *  says more than the role. */
function needs(list: { role: string; count: number; requiredType: { name: string } | null }[]) {
  const parts = list.map((n) => {
    const role = n.role.toLowerCase();
    const named = `${n.count} ${role}${n.count > 1 && !role.endsWith("s") ? "s" : ""}`;
    return n.requiredType && !n.requiredType.name.toLowerCase().startsWith(role) ? `${named} (${qualificationShort(n.requiredType.name)})` : named;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
}

/** School lessons, parties, lane hire and events at one site, and how many of
 *  their places still to come need someone. Each session is on the week plan. */
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaBookings((await searchParams).site);
  const { site } = data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={site ? `Bookings: ${site.name}` : "Bookings"}
        description="School lessons, parties, lane hire and events that need staff. Each session is on the week plan with its places to fill."
        actions={site?.manage ? <BookingDialog siteId={site.id} today={data.today} departments={data.departments} types={data.types} /> : undefined} />
      {data.bookings.length === 0 ? (
        <EmptyState icon="calendarRange" title="No bookings yet" hint="When a school, a party or a club books time that needs staff, add it here." />
      ) : (
        <section aria-label="Bookings" className="pc-panel">
          <ul className="pc-rows">
            {data.bookings.map((b) => {
              const meta = BOOKING_KIND_META[b.kind as BookingKind];
              return (
                <li key={b.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="flex flex-wrap items-center gap-2"><span className="pc-row-title">{b.title}</span><Tag meta={meta} /></span>
                    <span className="pc-row-hint">{weekdays(b.weekdays)}, {formatTimeRange(b.startMinutes, b.endMinutes)} · {b.firstDay.getTime() === b.lastDay.getTime() ? day(b.firstDay) : `${day(b.firstDay)} to ${day(b.lastDay)}`}{b.place ? ` · ${b.place}` : ""}{b.department ? ` · ${b.department.name}` : ""}</span>
                    <span className="pc-row-hint">{[`Needs ${needs(b.needs)}`, b.unfilled ? `${plural(b.unfilled, "place")} still to fill` : "fully staffed", b.note || null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    {site?.manage && b.lastDay.toISOString().slice(0, 10) >= data.today ? <CancelBooking id={b.id} label={b.title} staffedThisWeek={b.staffedThisWeek} /> : null}
                    <Button asChild><Link href={`/rota?${new URLSearchParams({ site: site!.id, week: b.firstDay.toISOString().slice(0, 10) > data.today ? b.firstDay.toISOString().slice(0, 10) : data.today })}`}><Users aria-hidden="true" />Plan who</Link></Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
