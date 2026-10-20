"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, LogOut, MapPin } from "lucide-react";
import { api, message, signOut, type Booking, type BookingState } from "@/lib/api";
import { BOOKING_META, day, euro, span } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/shadcn/button";
import { Frame, Loading, Notice, Tag } from "@/components/ui";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";

const GROUPS: { title: string; states: BookingState[] }[] = [
  { title: "Coming up", states: ["to-pay", "booked"] },
  { title: "Waiting lists", states: ["waiting"] },
  { title: "Past and withdrawn", states: ["done", "withdrawn", "cancelled"] },
];
const CALL_BY = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/** My bookings: every place booked under the signed-in email, online or at the desk, at every
 *  centre: what is coming up and what is left to pay, waiting lists, then the past year. */
export default function BookingsPage() {
  const router = useRouter();
  const who = useSession();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (who === null) { router.replace("/sign-in"); return; }
    if (!who) return;
    let live = true;
    api<{ bookings: Booking[] }>("me/bookings", { auth: true })
      .then((r) => { if (live) setBookings(r.bookings); })
      .catch((e) => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [who, router]);

  return (
    <Frame title="My bookings">
      <PageShell spacing="roomy" header={<PageHeader title="My bookings"
        description={who ? `Booked under ${who.email}, online or at reception.` : undefined}
        actions={who ? <Button type="button" variant="outline" onClick={() => void signOut()}><LogOut aria-hidden="true" />Sign out</Button> : null} />}>
      {error ? <Notice title="Couldn't load your bookings" tone="error">{error}</Notice> : null}
      {!bookings && !error ? <Loading rows={2} /> : null}
      {bookings && bookings.length === 0 ? (
        <Notice title="Nothing booked under this email yet">If you booked at reception with another email address, sign in with that one. <Link href="/">Have a look at the courses.</Link></Notice>
      ) : null}
      {bookings ? GROUPS.map((g) => {
        const list = bookings.filter((b) => g.states.includes(b.state));
        if (!list.length) return null;
        return (
          <section key={g.title} className="flex flex-col gap-2" aria-label={g.title}>
            <h2>{g.title}</h2>
            <ul className="pc-rows">
              {list.map((b) => {
                const toPay = b.state === "to-pay";
                return (
                  <li key={b.id} className="pc-row booking-row" data-muted={["done", "withdrawn", "cancelled"].includes(b.state) ? "" : undefined}>
                    <span className="pc-row-body">
                      <span className="pc-row-title">{b.name}</span>
                      <span className="booking-meta">
                        <span><CalendarDays aria-hidden="true" />{b.next && b.state !== "done" ? `Next: ${day(b.next.date)}, ${b.next.start}` : span(b.firstDay, b.lastDay)}</span>
                        <span><MapPin aria-hidden="true" />{b.site}{b.next?.place ? `, ${b.next.place}` : ""}</span>
                      </span>
                      <span className="pc-row-hint">{[b.person, b.reference ? `Ref ${b.reference}` : null,
                        toPay ? (b.callBy && Date.parse(b.callBy) > Date.now() ? `We will phone you by ${CALL_BY.format(new Date(b.callBy))} to take ${euro(b.owedCents)}` : `We will phone you soon to take ${euro(b.owedCents)}`)
                          : b.state === "booked" ? (b.owedCents ? `${b.detail}, ${euro(b.owedCents)} left to pay` : b.detail || null)
                          : b.state === "waiting" ? "We will phone you if a place comes up" : b.detail || null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="pc-row-trail"><Tag meta={BOOKING_META[b.state]} /></span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      }) : null}
      </PageShell>
    </Frame>
  );
}
