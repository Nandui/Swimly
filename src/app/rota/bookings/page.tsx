import type { Metadata } from "next";
import { areasAt } from "@/lib/directory";
import Link from "next/link";
import { CalendarDays, CalendarRange, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Figure, Figures } from "@/components/ui-kit/figure";
import { Tag } from "@/components/ui-kit/tag";
import { Progress } from "@/components/shadcn/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { BOOKING_KIND_META, BookingDialog, type BookingKind, CancelBooking, KindStaffDialog, clock, lanesLabel, rotaRepeats, WEEKDAY_LABELS } from "@/modules/rota/features/bookings";
import { formatDate, formatTimeRange, plural, toDateOnlyString, today } from "@/lib/format";

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
 *  activity on its days, planned on the Plan like any other. Laid out again 20 October 2026: three
 *  figures, then running bookings apart from finished ones, as a table from 1024px (with how much
 *  of each is filled) and as rows below. */
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaRepeats((await searchParams).site);
  const { site } = data;
  const now = today();
  // Where a booking happens: the site's areas, kept in Admin.
  const areas = site ? await areasAt(site.id) : [];
  const laneCount = (place: string) => areas.find((a) => a.name.toLowerCase() === place.toLowerCase())?.lanes ?? 0;
  type Repeat = (typeof data.repeats)[number];
  const fill = (b: Repeat) => {
    const total = b.needs.reduce((n, x) => n + x.places, 0);
    const filled = b.needs.reduce((n, x) => n + Math.min(x._count.assignments, x.places), 0);
    return { total, filled, open: total - filled };
  };
  const span = (b: Repeat) => (b.firstDay.getTime() === b.lastDay.getTime() ? day(b.firstDay) : `${day(b.firstDay)} to ${day(b.lastDay)}`);
  const where = (b: Repeat) => (b.place ? `${b.place}${laneCount(b.place) ? `, ${lanesLabel(b.lanes, laneCount(b.place)).toLowerCase()}` : ""}` : "");
  const running = data.repeats.filter((b) => b.needs.length);
  const finished = data.repeats.filter((b) => !b.needs.length);
  const openPlaces = running.reduce((n, b) => n + fill(b).open, 0);
  const actions = (b: Repeat) => {
    const first = b.firstDay.toISOString().slice(0, 10);
    return <>
      {site?.plan && data.types.length ? <BookingDialog siteId={site.id} today={now} types={data.types} areas={areas} kindStaff={data.kindStaff} booking={{
        id: b.id, kind: b.kind, title: b.title, typeId: b.typeId, place: b.place, lanes: b.lanes, start: clock(b.startMinutes), end: clock(b.endMinutes), places: b.places,
        weekdays: b.weekdays, firstDay: first, lastDay: toDateOnlyString(b.lastDay), skipDates: b.skipDates.map(toDateOnlyString),
      }} /> : null}
      {site?.plan && b.needs.length ? <CancelBooking id={b.id} label={b.title} /> : null}
      <Button asChild variant="outline"><Link href={`/rota?${new URLSearchParams({ site: site!.id, dept: b.type.departmentId, day: first > now ? first : now })}`}><CalendarDays aria-hidden="true" />Plan who</Link></Button>
    </>;
  };
  return (
    <PageShell spacing="roomy" header={<PageHeader title={site ? `Bookings: ${site.name}` : "Bookings"}
        description="Schools, parties and lane hire that repeat over weeks. Each adds its activity on its days, ready to plan who."
        actions={site?.plan && data.types.length ? <>
          <KindStaffDialog siteId={site.id} kindStaff={data.kindStaff} />
          <BookingDialog siteId={site.id} today={now} types={data.types} areas={areas} kindStaff={data.kindStaff} />
        </> : undefined} />}>
      {data.repeats.length === 0 ? (
        <EmptyState icon="calendarRange" title="No bookings yet" hint="When a school, a party or a club books time that needs staff, add it here." />
      ) : (
        <>
          <Figures label="Bookings at a glance">
            <Figure icon={CalendarRange} label="Running bookings" value={running.length} />
            <Figure icon={CalendarDays} label="Days still to come" value={running.reduce((n, b) => n + b.needs.length, 0)} />
            <Figure icon={Users} label="Places still to fill" value={openPlaces} hint={openPlaces ? "Need someone" : "All filled"} tone={openPlaces ? "orange" : undefined} />
          </Figures>
          {[{ id: "bookings-running", title: "Running", hint: "Bookings with days still to come.", list: running }, { id: "bookings-done", title: "Finished", hint: "No days left to come. Kept so you can see what ran.", list: finished }]
            .filter((x) => x.list.length).map((x) => (
            <section key={x.id} aria-labelledby={x.id} className="flex min-w-0 flex-col">
              <div className="pc-section-head"><h2 id={x.id}>{x.title}</h2><p>{x.list.length}</p></div>
              <p className="pc-section-note">{x.hint}</p>
              <Table containerClassName="rota-wide-only">
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Where</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Filled</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {x.list.map((b) => {
                    const f = fill(b);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-normal"><span className="flex flex-col items-start gap-1"><span className="font-semibold">{b.title}</span><Tag meta={BOOKING_KIND_META[b.kind as BookingKind]} /></span></TableCell>
                        <TableCell className="whitespace-normal tabular-nums"><span className="flex flex-col"><span>{weekdays(b.weekdays)}, {formatTimeRange(b.startMinutes, b.endMinutes)}</span><span className="text-xs text-ui-muted-foreground">{span(b)}</span></span></TableCell>
                        <TableCell className="whitespace-normal">{where(b) || "—"}</TableCell>
                        <TableCell className="whitespace-normal"><span className="flex flex-col"><span>{b.type.name}</span><span className="text-xs text-ui-muted-foreground">{b.places ? `${plural(b.places, "person", "people")} each day` : "No staff needed"}</span></span></TableCell>
                        <TableCell className="min-w-40">{b.needs.length ? (
                          <span className="flex flex-col gap-1"><span className="tabular-nums text-xs">{f.open ? `${plural(f.open, "place")} to fill` : "All filled"} · {plural(b.needs.length, "day")} to come</span>
                            <Progress value={f.total ? Math.round((f.filled / f.total) * 100) : 100} aria-label={`${f.filled} of ${f.total} places filled`} /></span>
                        ) : <span className="text-xs text-ui-muted-foreground">Finished</span>}</TableCell>
                        <TableCell><span className="flex flex-nowrap justify-end gap-2">{actions(b)}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ul className="pc-list rota-narrow-only">
                {x.list.map((b) => {
                  const f = fill(b);
                  return (
                    <li key={b.id} className="pc-row">
                      <span className="pc-row-body">
                        <span className="flex flex-wrap items-center gap-2"><span className="pc-row-title">{b.title}</span><Tag meta={BOOKING_KIND_META[b.kind as BookingKind]} /></span>
                        <span className="pc-row-hint">{weekdays(b.weekdays)}, {formatTimeRange(b.startMinutes, b.endMinutes)} · {span(b)}{where(b) ? ` · ${where(b)}` : ""}</span>
                        <span className="pc-row-hint">{b.type.name}, {b.places ? `${plural(b.places, "person", "people")} each day` : "no staff needed"} · {b.needs.length ? `${plural(b.needs.length, "day")} to come, ${f.open ? `${plural(f.open, "place")} still to fill` : "all filled"}` : "no days still to come"}</span>
                      </span>
                      <span className="pc-row-trail">{actions(b)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </PageShell>
  );
}
