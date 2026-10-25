import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { liveSiteIds, sitePhones, sitesByIds } from "@/lib/directory";
import { formatTime, parseDateOnly, toDateOnlyString as iso, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AppCourseError, type AppCourse, type AppCourseBooking, type AppCourseHeld, type AppCourseHold, type AppCourses } from "@/modules/contributions";
import { holdDeadline, newReference } from "@/modules/short-courses/shared/public-booking";
import { ageOn, euro, inParentsApp, stillOwed, takesPlace } from "@/modules/short-courses/shared/rules";

/** Swimming courses in the parents app (owner decisions, 21 October 2026),
 *  registered through `registerAppCourses` for the swim school's parent API:
 *
 *  - A Pool course shows once Manage ticks "Show in the parents app", until its first session.
 *  - Holding a place books the swimmer on with payment owed, `source` online and a deadline to be
 *    phoned (`callBy`, 72 hours), linked to their swimmer record, so the desk's "To phone" list
 *    and the call need nothing more.
 *  - A full course is just full: no waiting list in the app.
 *
 *  Nothing here returns staff names, other people or anything entered by staff. */

const APP_COURSE = {
  id: true, siteId: true, status: true, capacity: true, priceCents: true, cancelledAt: true, bookOnline: true,
  type: { select: { name: true, area: true, description: true, minAge: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true, place: true } },
  participants: { select: { status: true } },
} satisfies Prisma.ShortCourseSelect;
type Row = Prisma.ShortCourseGetPayload<{ select: typeof APP_COURSE }>;

const sessionOf = (s: { date: Date; startMinutes: number; endMinutes: number; place: string }) => ({ date: iso(s.date), start: formatTime(s.startMinutes), end: formatTime(s.endMinutes), place: s.place });
const firstDayOf = (c: Pick<Row, "sessions">) => (c.sessions[0] ? iso(c.sessions[0].date) : null);
const priceOf = (cents: number) => (cents ? euro(cents) : "Free");
const where = { bookOnline: true, cancelledAt: null, status: "planned", type: { area: "pool" } } satisfies Prisma.ShortCourseWhereInput;

async function shape(rows: Row[], db?: Prisma.TransactionClient): Promise<AppCourse[]> {
  const ids = rows.map((r) => r.siteId);
  const [sites, phones] = await Promise.all([sitesByIds(ids, db), sitePhones(ids, db)]);
  const on = today();
  return rows.filter((c) => inParentsApp(c, c.type.area, firstDayOf(c), on) && sites.has(c.siteId)).map((c) => ({
    id: c.id,
    name: c.type.name,
    description: c.type.description,
    site: { id: c.siteId, name: sites.get(c.siteId)!.name, phone: phones.get(c.siteId) ?? "" },
    minAge: c.type.minAge,
    priceCents: c.priceCents,
    price: priceOf(c.priceCents),
    placesLeft: Math.max(0, c.capacity - c.participants.filter((p) => takesPlace(p.status)).length),
    firstDay: iso(c.sessions[0].date),
    lastDay: iso(c.sessions[c.sessions.length - 1].date),
    sessions: c.sessions.map(sessionOf),
  }));
}

async function list() {
  const rows = await prisma.shortCourse.findMany({
    where: { ...where, siteId: { in: await liveSiteIds() }, sessions: { some: {} }, NOT: { sessions: { some: { date: { lte: parseDateOnly(today()) } } } } },
    select: APP_COURSE, take: 200,
  });
  return (await shape(rows)).sort((a, b) => a.firstDay.localeCompare(b.firstDay) || a.name.localeCompare(b.name));
}

async function one(id: string) {
  const row = await prisma.shortCourse.findFirst({ where: { id, ...where, siteId: { in: await liveSiteIds() } }, select: APP_COURSE });
  return row ? (await shape([row]))[0] ?? null : null;
}

async function hold(tx: Prisma.TransactionClient, input: AppCourseHold): Promise<AppCourseHeld> {
  // The course row is locked while places are counted, so the last place is never taken twice.
  await tx.$queryRaw`SELECT id FROM "short_courses_courses" WHERE id = ${input.courseId} FOR UPDATE`;
  const row = await tx.shortCourse.findFirst({ where: { id: input.courseId, ...where }, select: APP_COURSE });
  const [course] = row ? await shape([row], tx) : [];
  if (!row || !course) throw new AppCourseError(404, "NOT_FOUND", "That course is no longer open for booking.");
  if (course.minAge !== null) {
    if (!input.dateOfBirth) throw new AppCourseError(409, "DATE_OF_BIRTH_REQUIRED", "We need a date of birth to check the age for this course.");
    if (ageOn(input.dateOfBirth, course.firstDay) < course.minAge) {
      throw new AppCourseError(409, "TOO_YOUNG", `This course is for ${course.minAge} and over on the first day.`);
    }
  }
  const people = await tx.shortCourseParticipant.findMany({ where: { courseId: row.id }, select: { status: true, swimmerId: true } });
  if (people.some((p) => p.swimmerId === input.swimmerId && p.status !== "withdrawn")) {
    throw new AppCourseError(409, "ALREADY_BOOKED", "They already have a place on this course.");
  }
  if (people.filter((p) => takesPlace(p.status)).length >= row.capacity) {
    throw new AppCourseError(409, "FULL", `Sorry, this course is full.${course.site.phone ? ` Phone ${course.site.name} on ${course.site.phone} about the next one.` : ""}`);
  }
  const heldAt = new Date(), callBy = holdDeadline(heldAt);
  for (let attempt = 0; ; attempt++) {
    const reference = newReference("SC");
    // A reference already taken: try another (checked first, so the transaction is never aborted).
    if (await tx.shortCourseParticipant.findUnique({ where: { reference }, select: { id: true } })) {
      if (attempt >= 4) throw new AppCourseError(503, "UNAVAILABLE", "Please try again in a moment.");
      continue;
    }
    const made = await tx.shortCourseParticipant.create({ data: {
      courseId: row.id, swimmerId: input.swimmerId, name: input.name, email: input.email, phone: input.phone,
      dateOfBirth: input.dateOfBirth ? parseDateOnly(input.dateOfBirth) : null, status: "booked", payment: "owed", source: "online",
      reference, callTimes: input.callTimes, callBy, note: input.note, createdByName: "Parents app", createdAt: heldAt,
    }, select: { id: true } });
    await logAudit({ actorId: null, actorName: input.by, action: "create", entity: "ShortCourseParticipant", entityId: made.id, clubId: row.siteId,
      summary: `Held a place in the parents app on the ${course.name} course for ${input.name} (${reference}); to phone for payment by ${callBy.toISOString()}` }, tx);
    return { reference, callBy: callBy.toISOString(), course: course.name, site: course.site.name, firstDay: course.firstDay, price: course.price };
  }
}

/** Places on Pool courses for these swimmers that ended within the last year, however they were booked. */
async function bookingsFor(swimmerIds: readonly string[]): Promise<AppCourseBooking[]> {
  if (!swimmerIds.length) return [];
  const since = parseDateOnly(new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10));
  const rows = await prisma.shortCourseParticipant.findMany({
    where: { swimmerId: { in: [...swimmerIds] }, course: { type: { area: "pool" }, NOT: { sessions: { every: { date: { lt: since } } } } } },
    orderBy: { createdAt: "desc" }, take: 50,
    select: {
      id: true, swimmerId: true, reference: true, status: true, payment: true, paidCents: true, callBy: true,
      attendance: { select: { present: true } },
      course: { select: { id: true, siteId: true, priceCents: true, status: true, cancelledAt: true, type: { select: { name: true } },
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
      : r.payment === "owed" && stillOwed(c.priceCents, r) > 0 ? "to-pay" : "booked";
    return {
      id: r.id, courseId: c.id, swimmerId: r.swimmerId!, name: c.type.name, site: sites.get(c.siteId)?.name ?? "", reference: r.reference, state,
      firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null, lastDay: last, sessions: c.sessions.length,
      next: next && state !== "cancelled" && state !== "withdrawn" ? sessionOf(next) : null,
      marked: r.attendance.length, attended: r.attendance.filter((a) => a.present).length,
      price: priceOf(c.priceCents), callBy: state === "to-pay" && r.callBy ? r.callBy.toISOString() : null,
    };
  });
}

export const parentsAppCourses: AppCourses = { list, one, hold, bookingsFor };
