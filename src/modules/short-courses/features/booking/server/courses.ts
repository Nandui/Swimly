import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { liveSiteById, liveSiteIds, sitesByIds, withSites } from "@/lib/directory";
import { formatTime, parseDateOnly, toDateOnlyString as iso, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PublicApiError } from "@/lib/public-api/http";
import { dayWords, holdDeadline, newReference, whenWords, type CustomerBooking, type HoldInput, type PublicCourse, type PublicCourseSource, type PublicHold } from "@/modules/short-courses/shared/public-booking";
import {
  ageOn, euro, SHORT_COURSE_AREA_META, SHORT_COURSE_PAYMENT_META, stillOwed, takesPlace, type ShortCourseArea, type ShortCoursePayment,
} from "@/modules/short-courses/shared/rules";

/** Short courses on the public booking site (phase 2, 15 October 2026; docs/short-courses.md),
 *  one of the two sources api.ts lists. The same as Academy courses (academy.ts):
 *
 *  - A course shows online when Manage ticks "Open for online booking", until its first session.
 *  - Holding a place books them on with payment owed, `source` online and a deadline to be phoned
 *    (`callBy`, 72 hours). The desk sees them on the course and on Short courses' "To phone" list.
 *  - When the course is full they can join its waiting list instead (first come, first served);
 *    the desk phones them if a place frees, as for anyone waiting.
 *  - A customer sees every place booked under their checked email, whoever entered it.
 *
 *  Nothing here returns staff names, other people or anything entered by staff. */

export const SHORT_COURSES_SOURCE = "short-courses";

const PUBLIC_COURSE = {
  id: true, siteId: true, status: true, capacity: true, priceCents: true, cancelledAt: true, bookOnline: true,
  type: { select: { name: true, area: true, description: true, minAge: true, healthForm: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true, place: true } },
  participants: { select: { status: true } },
} satisfies Prisma.ShortCourseSelect;
type PublicRow = Prisma.ShortCourseGetPayload<{ select: typeof PUBLIC_COURSE }> & { site: { name: string } };

const sessionOf = (s: { date: Date; startMinutes: number; endMinutes: number; place: string }) => ({ date: iso(s.date), start: formatTime(s.startMinutes), end: formatTime(s.endMinutes), place: s.place });
const areaLabel = (area: string) => (SHORT_COURSE_AREA_META[area as ShortCourseArea] ?? SHORT_COURSE_AREA_META.other).label;

function publicCourse(c: PublicRow): PublicCourse {
  return {
    id: c.id,
    source: SHORT_COURSES_SOURCE,
    name: c.type.name,
    group: "course",
    category: c.type.area,
    categoryLabel: areaLabel(c.type.area),
    description: c.type.description,
    awardingBody: "",
    minAge: c.type.minAge,
    checks: c.type.healthForm ? ["Health form"] : [],
    askDateOfBirth: c.type.minAge !== null,
    site: c.site.name,
    priceCents: c.priceCents,
    price: c.priceCents ? euro(c.priceCents) : "Free",
    placesLeft: Math.max(0, c.capacity - c.participants.filter((p) => takesPlace(p.status)).length),
    waitingList: true,
    firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null,
    lastDay: c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null,
    sessions: c.sessions.map(sessionOf),
  };
}

/** Put online, still planned, and its first session still to come. */
export function shortCourseOnline(c: { bookOnline: boolean; status: string; cancelledAt: Date | null }, firstDay: string | null, on: string) {
  return c.bookOnline && !c.cancelledAt && c.status === "planned" && !!firstDay && firstDay > on;
}

const onlineWhere = { bookOnline: true, cancelledAt: null, status: "planned" } satisfies Prisma.ShortCourseWhereInput;

async function list() {
  const on = today();
  const rows = await withSites(await prisma.shortCourse.findMany({
    where: { ...onlineWhere, siteId: { in: await liveSiteIds() }, sessions: { some: {} }, NOT: { sessions: { some: { date: { lte: parseDateOnly(on) } } } } },
    select: PUBLIC_COURSE, take: 100,
  }), "siteId", "site");
  return rows.filter((c) => shortCourseOnline(c, c.sessions[0] ? iso(c.sessions[0].date) : null, on)).map(publicCourse);
}

async function openCourse(id: string) {
  const row = await prisma.shortCourse.findFirst({ where: { id, ...onlineWhere }, select: PUBLIC_COURSE });
  const site = row ? await liveSiteById(row.siteId) : null;
  if (!row || !site || !shortCourseOnline(row, row.sessions[0] ? iso(row.sessions[0].date) : null, today())) return null;
  return { ...row, site: { name: site.name } };
}

/** Hold a place, or join the waiting list when the course is full and they asked to. */
async function hold(email: string, input: HoldInput): Promise<PublicHold> {
  const c = await openCourse(input.courseId);
  if (!c) throw new PublicApiError(404, "NOT_FOUND", "That course is not open for booking.");
  const first = c.sessions[0];
  if (input.dateOfBirth && (input.dateOfBirth > today() || input.dateOfBirth < "1900-01-01")) throw new PublicApiError(400, "INVALID_REQUEST", "Check your date of birth.");
  if (c.type.minAge !== null) {
    if (!input.dateOfBirth) throw new PublicApiError(400, "INVALID_REQUEST", "Enter your date of birth.");
    if (ageOn(input.dateOfBirth, iso(first.date)) < c.type.minAge) throw new PublicApiError(422, "TOO_YOUNG", `You need to be ${c.type.minAge} or over on the first day of the course.`);
  }
  if ((await prisma.shortCourseParticipant.count({ where: { email, source: "online", createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 5) {
    throw new PublicApiError(429, "RATE_LIMITED", "Too many attempts. Wait a while and try again.");
  }

  const heldAt = new Date(), callBy = holdDeadline(heldAt);
  let made: { reference: string; waiting: boolean } | null = null;
  for (let attempt = 0; !made; attempt++) {
    const reference = newReference("SC");
    try {
      made = await prisma.$transaction(async (tx) => {
        // The course row is locked while places are counted, so the last place is never taken twice.
        await tx.$queryRaw`SELECT id FROM "short_courses_courses" WHERE id = ${c.id} FOR UPDATE`;
        const people = await tx.shortCourseParticipant.findMany({ where: { courseId: c.id }, select: { status: true, email: true } });
        const mine = people.find((p) => p.status !== "withdrawn" && p.email.toLowerCase() === email);
        if (mine) {
          throw new PublicApiError(409, "ALREADY_BOOKED", mine.status === "waiting"
            ? "You are already on the waiting list for this course. We will phone you if a place comes up."
            : "You already have a place on this course. We will phone you about it.");
        }
        const waiting = people.filter((p) => takesPlace(p.status)).length >= c.capacity;
        if (waiting && !input.waitingList) throw new PublicApiError(409, "FULL", "Sorry, the last place has just gone. You can join the waiting list instead.");
        const row = await tx.shortCourseParticipant.create({ data: {
          courseId: c.id, name: input.name, email, phone: input.phone, phone2: input.phone2, dateOfBirth: input.dateOfBirth ? parseDateOnly(input.dateOfBirth) : null,
          status: waiting ? "waiting" : "booked", payment: "owed", source: "online", reference, callTimes: input.callTimes, callBy: waiting ? null : callBy,
          note: input.note, createdByName: "Online booking", createdAt: heldAt,
        } });
        await logAudit({ actorId: null, actorName: `${input.name} (online)`, action: "create", entity: "ShortCourseParticipant", entityId: row.id, clubId: c.siteId,
          summary: waiting ? `Joined the waiting list online for the ${c.type.name} course (${reference})`
            : `Held a place online on the ${c.type.name} course (${reference}); to phone for payment by ${callBy.toISOString()}` }, tx);
        return { reference, waiting };
      });
    } catch (error) {
      // A reference already taken (unique constraint): try another.
      const clash = (error as { code?: unknown })?.code === "P2002";
      if (!clash || attempt >= 4) throw error;
    }
  }
  return {
    reference: made.reference, outcome: made.waiting ? "waiting" : "held",
    callBy: made.waiting ? null : callBy.toISOString(), callByLabel: made.waiting ? null : whenWords(callBy), phone: input.phone,
    price: c.priceCents ? euro(c.priceCents) : "nothing",
    course: { name: c.type.name, site: c.site.name, starts: `${dayWords(first.date)} at ${formatTime(first.startMinutes)}` },
  };
}

/** Every place under this email on a course that ended within the last year, newest first. */
async function bookingsFor(email: string): Promise<CustomerBooking[]> {
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
      id: r.id, source: SHORT_COURSES_SOURCE, reference: r.reference, courseId: c.id, name: c.type.name, person: r.name, categoryLabel: areaLabel(c.type.area),
      site: sites.get(c.siteId)?.name ?? "", firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null, lastDay: last, sessions: c.sessions.length,
      next: next ? sessionOf(next) : null, state,
      detail: state === "waiting" ? "" : SHORT_COURSE_PAYMENT_META[r.payment as ShortCoursePayment]?.label ?? "",
      priceCents: c.priceCents, paidCents: r.paidCents, owedCents: r.status === "booked" ? stillOwed(c.priceCents, r) : 0,
      callBy: state === "to-pay" && r.callBy ? r.callBy.toISOString() : null,
    };
  });
}

export const shortCoursePublicCourses: PublicCourseSource = {
  id: SHORT_COURSES_SOURCE,
  list,
  one: async (id) => { const c = await openCourse(id); return c ? publicCourse(c) : null; },
  hold,
  bookingsFor,
};
