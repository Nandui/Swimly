import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { liveSiteById, liveSiteIds, sitesByIds, withSites } from "@/lib/directory";
import { formatTime, parseDateOnly, toDateOnlyString as iso, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PublicApiError } from "@/lib/public-api/http";
import { dayWords, newReference, whenWords, type CustomerBooking, type HoldInput, type PublicCourse, type PublicCourseSource, type PublicHold } from "@/lib/public-booking";
import {
  ACADEMY_CHECKS, ACADEMY_KIND_META, ACADEMY_PAYMENT_META, ACADEMY_RESULT_META, ageOn, bookableOnline, callByFrom, euro, takesPlace,
  type AcademyCheck, type AcademyKind, type AcademyPayment, type AcademyResult,
} from "@/modules/academy/shared/rules";

/** The Academy's courses on the public booking site (owner decision, 8 October 2026;
 *  docs/academy.md), registered as a public course source in module.ts.
 *
 *  - Anyone can read the courses put online that have not started.
 *  - A place held online is a candidate with payment owed, `source` online and a deadline to be
 *    phoned (`callBy`, 72 hours). Staff see them on the Academy's "To call" list.
 *  - A customer sees every place booked under their checked email, whoever entered it.
 *
 *  Nothing here returns staff names, other candidates or anything entered by staff. */

export const ACADEMY_SOURCE = "academy";

const PUBLIC_COURSE = {
  id: true, siteId: true, status: true, capacity: true, priceCents: true, cancelledAt: true, bookOnline: true,
  type: { select: { name: true, kind: true, awardingBody: true, minAge: true, checks: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true, place: true } },
  candidates: { select: { status: true } },
} satisfies Prisma.AcademyCourseSelect;
type PublicRow = Prisma.AcademyCourseGetPayload<{ select: typeof PUBLIC_COURSE }> & { site: { name: string } };

const sessionOf = (s: { date: Date; startMinutes: number; endMinutes: number; place: string }) => ({ date: iso(s.date), start: formatTime(s.startMinutes), end: formatTime(s.endMinutes), place: s.place });

function publicCourse(c: PublicRow): PublicCourse {
  const left = Math.max(0, c.capacity - c.candidates.filter((x) => takesPlace(x.status)).length);
  return {
    id: c.id,
    source: ACADEMY_SOURCE,
    name: c.type.name,
    group: "qualification",
    category: c.type.kind,
    categoryLabel: ACADEMY_KIND_META[c.type.kind as AcademyKind]?.label ?? "Other",
    description: "",
    awardingBody: c.type.awardingBody,
    minAge: c.type.minAge,
    checks: c.type.checks.filter((k): k is AcademyCheck => k in ACADEMY_CHECKS && k !== "age").map((k) => ACADEMY_CHECKS[k]),
    askDateOfBirth: true,
    site: c.site.name,
    priceCents: c.priceCents,
    price: c.priceCents ? euro(c.priceCents) : "Free",
    placesLeft: left,
    waitingList: false,
    firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null,
    lastDay: c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null,
    sessions: c.sessions.map(sessionOf),
  };
}

const onlineWhere = { bookOnline: true, cancelledAt: null, status: "planned" } satisfies Prisma.AcademyCourseWhereInput;

/** Every course open online, full ones too, so people can see them. */
async function list() {
  const on = today();
  const rows = await withSites(await prisma.academyCourse.findMany({
    where: { ...onlineWhere, siteId: { in: await liveSiteIds() }, sessions: { some: {} }, NOT: { sessions: { some: { date: { lte: parseDateOnly(on) } } } } },
    select: PUBLIC_COURSE, take: 100,
  }), "siteId", "site");
  return rows.filter((c) => bookableOnline(c, c.sessions[0] ? iso(c.sessions[0].date) : null, on)).map(publicCourse);
}

async function openCourse(id: string) {
  const row = await prisma.academyCourse.findFirst({ where: { id, ...onlineWhere }, select: PUBLIC_COURSE });
  const site = row ? await liveSiteById(row.siteId) : null;
  if (!row || !site || !bookableOnline(row, row.sessions[0] ? iso(row.sessions[0].date) : null, today())) return null;
  return { ...row, site: { name: site.name } };
}

const tooMany = () => new PublicApiError(429, "RATE_LIMITED", "Too many attempts. Wait a while and try again.");

/** Hold a place: within the places and the minimum age, one per email on a course. */
async function hold(email: string, input: HoldInput): Promise<PublicHold> {
  const c = await openCourse(input.courseId);
  if (!c) throw new PublicApiError(404, "NOT_FOUND", "That course is not open for booking.");
  const first = c.sessions[0];
  if (!input.dateOfBirth) throw new PublicApiError(400, "INVALID_REQUEST", "Enter your date of birth.");
  if (input.dateOfBirth > today() || input.dateOfBirth < "1900-01-01") throw new PublicApiError(400, "INVALID_REQUEST", "Check your date of birth.");
  if (c.type.minAge !== null && ageOn(input.dateOfBirth, iso(first.date)) < c.type.minAge) {
    throw new PublicApiError(422, "TOO_YOUNG", `You need to be ${c.type.minAge} or over on the first day of the course.`);
  }
  if ((await prisma.academyCandidate.count({ where: { email, source: "online", createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 5) throw tooMany();

  const heldAt = new Date(), callBy = callByFrom(heldAt);
  let reference = "";
  for (let attempt = 0; !reference; attempt++) {
    const candidate = newReference("AC");
    try {
      await prisma.$transaction(async (tx) => {
        // One booking at a time per course, so the last place is never taken twice.
        await tx.$queryRaw`SELECT id FROM "AcademyCourse" WHERE id = ${c.id} FOR UPDATE`;
        const taken = await tx.academyCandidate.findMany({ where: { courseId: c.id }, select: { status: true, email: true } });
        if (taken.some((t) => takesPlace(t.status) && t.email.toLowerCase() === email)) {
          throw new PublicApiError(409, "ALREADY_BOOKED", "You already have a place on this course. We will phone you about it.");
        }
        if (taken.filter((t) => takesPlace(t.status)).length >= c.capacity) throw new PublicApiError(409, "FULL", "Sorry, the last place has just gone.");
        const row = await tx.academyCandidate.create({ data: {
          courseId: c.id, name: input.name, email, phone: input.phone, phone2: input.phone2, dateOfBirth: parseDateOnly(input.dateOfBirth),
          payment: "owed", status: "booked", source: "online", reference: candidate, callTimes: input.callTimes, callBy, note: input.note,
          createdByName: "Online booking", createdAt: heldAt,
        } });
        await logAudit({ actorId: null, actorName: `${input.name} (online)`, action: "create", entity: "AcademyCandidate", entityId: row.id, clubId: c.siteId,
          summary: `Held a place online on the ${c.type.name} course (${candidate}); to phone for payment by ${callBy.toISOString()}` }, tx);
      });
      reference = candidate;
    } catch (error) {
      // A reference already taken (unique constraint): try another.
      const clash = (error as { code?: unknown })?.code === "P2002";
      if (!clash || attempt >= 4) throw error;
    }
  }
  return {
    reference, outcome: "held", callBy: callBy.toISOString(), callByLabel: whenWords(callBy), phone: input.phone,
    price: c.priceCents ? euro(c.priceCents) : "nothing",
    course: { name: c.type.name, site: c.site.name, starts: `${dayWords(first.date)} at ${formatTime(first.startMinutes)}` },
  };
}

/** Every place under this email that is not long finished, soonest first. */
async function bookingsFor(email: string): Promise<CustomerBooking[]> {
  const since = parseDateOnly(new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10));
  const rows = await prisma.academyCandidate.findMany({
    where: { email: { equals: email, mode: "insensitive" }, course: { NOT: { sessions: { every: { date: { lt: since } } } } } },
    orderBy: { createdAt: "desc" }, take: 50,
    select: {
      id: true, name: true, reference: true, status: true, payment: true, paidCents: true, callBy: true,
      course: { select: { id: true, siteId: true, priceCents: true, status: true, cancelledAt: true, type: { select: { name: true, kind: true } },
        sessions: { orderBy: [{ date: "asc" }, { startMinutes: "asc" }], select: { date: true, startMinutes: true, endMinutes: true, place: true } } } },
    },
  });
  const sites = await sitesByIds(rows.map((r) => r.course.siteId));
  const on = today();
  return rows.map((r) => {
    const c = r.course;
    const next = c.sessions.find((s) => iso(s.date) >= on);
    const last = c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null;
    const owed = r.payment === "paid" || r.payment === "waived" ? 0 : Math.max(0, c.priceCents - r.paidCents);
    const result = r.status as AcademyResult;
    const state = c.cancelledAt || c.status === "cancelled" ? "cancelled"
      : r.status === "withdrawn" ? "withdrawn"
      : ["passed", "referred", "failed"].includes(r.status) || c.status === "completed" || (last !== null && last < on) ? "done"
      : r.payment === "owed" ? "to-pay" : "booked";
    return {
      id: r.id, source: ACADEMY_SOURCE, reference: r.reference, courseId: c.id, name: c.type.name, person: r.name,
      categoryLabel: ACADEMY_KIND_META[c.type.kind as AcademyKind]?.label ?? "Other",
      site: sites.get(c.siteId)?.name ?? "", firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null, lastDay: last, sessions: c.sessions.length,
      next: next ? sessionOf(next) : null, state,
      detail: state === "done" && result !== "booked" ? ACADEMY_RESULT_META[result]?.label ?? "" : ACADEMY_PAYMENT_META[r.payment as AcademyPayment]?.label ?? "",
      priceCents: c.priceCents, paidCents: r.paidCents, owedCents: owed, callBy: state === "to-pay" && r.callBy ? r.callBy.toISOString() : null,
    };
  });
}

export const academyPublicCourses: PublicCourseSource = {
  id: ACADEMY_SOURCE,
  list,
  one: async (id) => { const c = await openCourse(id); return c ? publicCourse(c) : null; },
  hold,
  bookingsFor,
};
