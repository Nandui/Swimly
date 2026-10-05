import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { BookingDialog, CancelBooking } from "@/components/rota/bookings";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { BOOKING_KIND_META, WEEKDAY_LABELS, clock, type BookingKind } from "@/lib/rota/constants";
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
    return n.requiredType && !n.requiredType.name.toLowerCase().startsWith(role) ? `${named} (${n.requiredType.name})` : named;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
}

/** School lessons, parties, lane hire and events at one site, and how many of
 *  their places still to come need someone. Each session is on the week plan. */
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaBookings((await searchParams).site);
  const { site } = data;
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Bookings{site ? <span className="font-normal text-ui-muted-foreground">: {site.name}</span> : null}</h1>
          <p className="text-sm">School lessons, parties, lane hire and events that need staff. Each session is on the week plan with its places to fill.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.sites.length > 1 && site ? (
            <form method="get" className="flex items-center gap-2" aria-label="Choose a site">
              <div className="w-full sm:w-56"><NativeSelect name="site" defaultValue={site.id} aria-label="Site">
                {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect></div>
              <Button type="submit" variant="outline">Show</Button>
            </form>
          ) : null}
          {site?.manage ? <BookingDialog siteId={site.id} today={data.today} departments={data.departments} types={data.types} /> : null}
        </div>
      </div>
      {data.bookings.length === 0 ? (
        <EmptyState icon="calendarRange" title="No bookings" hint="When a school, a party or a club books time that needs staff, add it here." />
      ) : (
        <ul className="module-list">
          {data.bookings.map((b) => {
            const meta = BOOKING_KIND_META[b.kind as BookingKind];
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{b.title}</span><Tag meta={meta} /></p>
                  <p className="text-sm">{weekdays(b.weekdays)}, {clock(b.startMinutes)}–{clock(b.endMinutes)} · {b.firstDay.getTime() === b.lastDay.getTime() ? day(b.firstDay) : `${day(b.firstDay)} to ${day(b.lastDay)}`}{b.place ? ` · ${b.place}` : ""}{b.department ? ` · ${b.department.name}` : ""}</p>
                  <p className="text-xs text-ui-muted-foreground">{[`Needs ${needs(b.needs)}`, b.unfilled ? `${b.unfilled} ${b.unfilled === 1 ? "place" : "places"} still to fill` : "every place still to come is filled", b.note || null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" className="min-h-11"><Link href={`/rota?site=${site!.id}&week=${b.firstDay.toISOString().slice(0, 10) > data.today ? b.firstDay.toISOString().slice(0, 10) : data.today}`}>Plan who</Link></Button>
                  {site?.manage && b.lastDay.toISOString().slice(0, 10) >= data.today ? <CancelBooking id={b.id} label={b.title} staffedThisWeek={b.staffedThisWeek} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
