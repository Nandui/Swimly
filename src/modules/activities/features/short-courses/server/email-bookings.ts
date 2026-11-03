import "server-only";
import { parseDateOnly, formatTime, toDateOnlyString as iso, today } from "@/lib/format";
import { sitesByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import type { EmailBooking } from "@/modules/contributions";
import { SHORT_COURSE_AREA_META, SHORT_COURSE_PAYMENT_META, stillOwed, type ShortCourseArea, type ShortCoursePayment } from "@/modules/activities/shared/short-courses/rules";

/** Short course places under an email, for "My bookings" on the Academy booking site (registered
 *  in module.ts through the email bookings plug). Short courses are not sold online (owner choice,
 *  21 October 2026), but a place the desk booked under a customer's email still shows there.
 *  Nothing here returns staff names, other people or anything entered by staff. */

const SOURCE = "short-courses";
const sessionOf = (s: { date: Date; startMinutes: number; endMinutes: number; place: string }) => ({ date: iso(s.date), start: formatTime(s.startMinutes), end: formatTime(s.endMinutes), place: s.place });
const areaLabel = (area: string) => (SHORT_COURSE_AREA_META[area as ShortCourseArea] ?? SHORT_COURSE_AREA_META.other).label;

/** Every place under this email on a course that ended within the last year, newest first. */
export async function shortCourseEmailBookings(email: string): Promise<EmailBooking[]> {
  const since = parseDateOnly(new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10));
  const rows = await prisma.shortCourseParticipant.findMany({
    where: { email: { equals: email, mode: "insensitive" }, course: { NOT: { sessions: { every: { date: { lt: since } } } } } },
    orderBy: { createdAt: "desc" }, take: 50,
    select: {
      id: true, name: true, reference: true, status: true, payment: true, paidCents: true, callBy: true,
      course: { select: { id: true, siteId: true, priceCents: true, status: true, cancelledAt: true, type: { select: { name: true, area: true } },
        sessions: { orderBy: [{ date: "asc" }, { startMinutes: "asc" }], select: { date: true, startMinutes: true, endMinutes: true, place: true } } } },
    },
  });
  const sites = await sitesByIds(rows.map((r) => r.course.siteId));
  const on = today();
  return rows.map((r) => {
    const c = r.course;
    const next = c.sessions.find((s) => iso(s.date) >= on);
    const last = c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null;
    const state = c.cancelledAt || c.status === "cancelled" ? "cancelled"
      : r.status === "withdrawn" ? "withdrawn"
      : c.status === "finished" || (last !== null && last < on) ? "done"
      : r.status === "waiting" ? "waiting"
      : r.payment === "owed" ? "to-pay" : "booked";
    return {
      id: r.id, source: SOURCE, reference: r.reference, courseId: c.id, name: c.type.name, person: r.name, categoryLabel: areaLabel(c.type.area),
      site: sites.get(c.siteId)?.name ?? "", firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null, lastDay: last, sessions: c.sessions.length,
      next: next ? sessionOf(next) : null, state,
      detail: state === "waiting" ? "" : SHORT_COURSE_PAYMENT_META[r.payment as ShortCoursePayment]?.label ?? "",
      priceCents: c.priceCents, paidCents: r.paidCents, owedCents: r.status === "booked" ? stillOwed(c.priceCents, r) : 0,
      callBy: state === "to-pay" && r.callBy ? r.callBy.toISOString() : null,
    };
  });
}
