"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { staffContact } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { areaProblem } from "@/lib/setup/data";
import { ageOn, centsOf, clockOf, MAX_WEEKS, SHORT_COURSE_PAYMENTS, takesPlace, weeklyDates } from "@/modules/short-courses/shared/rules";
import { atSite, courseFor, iso, optionalDate, refresh } from "@/modules/short-courses/shared/server";

/** Short course writes (docs/short-courses.md). A course and everything on it is checked
 *  against its site: Manage puts courses and sessions on, Instructor (Run) takes registers, View
 *  (Read) books people on, records payment and keeps the waiting list. Every write is audited. */

/* ---------- Courses ---------- */

const courseSchema = z.object({
  siteId: z.string().min(1, "Choose the site."),
  typeId: z.string().min(1, "Choose the course."),
  capacity: z.coerce.number().int().min(1, "At least one place.").max(200),
  price: z.string().trim().default("0"),
  instructorId: z.string().min(1, "Choose the instructor."),
  note: z.string().trim().max(500).default(""),
  /** Shown on the public booking site until its first session (phase 2). */
  bookOnline: z.boolean().default(false),
  /** A new course only: its weekly sessions are made from these. */
  firstDay: z.string().default(""),
  weeks: z.coerce.number().int().min(1, "At least one week.").max(MAX_WEEKS, `At most ${MAX_WEEKS} weeks.`).default(6),
  start: z.string().default(""),
  end: z.string().default(""),
  place: z.string().trim().max(80).default(""),
});
export type CourseInput = z.input<typeof courseSchema>;

/** Put a course on at a site with its weekly sessions, or change its places, price, instructor
 *  and note. A changed day or time is changed on its sessions. */
export async function saveCourse(id: string | null, input: CourseInput): Promise<ActionResult & { id?: string }> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const before = id ? await prisma.shortCourse.findFirst({ where: { id }, select: { siteId: true, typeId: true, _count: { select: { participants: { where: { status: "booked" } } } } } }) : null;
  if (id && !before) return fail("That course no longer exists.");
  const siteId = before?.siteId ?? d.siteId;
  const at = await atSite(siteId, "short-courses.manage");
  if (!at.ok) return fail(at.error);
  const priceCents = centsOf(d.price || "0");
  if (priceCents === null) return fail("Give the price like 90 or 90.00.");
  if (before && d.capacity < before._count.participants) return fail(`${before._count.participants} people are booked on it. Withdraw some first, or keep at least that many places.`);
  const typeId = before?.typeId ?? d.typeId;
  const [type, instructor] = await Promise.all([
    prisma.shortCourseType.findFirst({ where: { id: typeId, orgId: at.site.orgId, ...(before ? {} : { archivedAt: null }) }, select: { name: true } }),
    staffContact(d.instructorId, at.site.orgId, { activeOnly: true }),
  ]);
  if (!type) return fail("That course is no longer on the list.");
  if (!instructor) return fail("That instructor is no longer active.");
  let schedule: { dates: string[]; start: number; end: number } | null = null;
  if (!id) {
    if (!isDateOnly(d.firstDay)) return fail("Choose the first day.");
    const start = clockOf(d.start), end = clockOf(d.end);
    if (start === null || end === null) return fail("Use times like 18:30.");
    if (end <= start) return fail("The session ends before it starts.");
    const problem = await areaProblem(siteId, d.place);
    if (problem) return fail(problem);
    schedule = { dates: weeklyDates(d.firstDay, d.weeks), start, end };
  }
  const data = { capacity: d.capacity, priceCents, instructorId: d.instructorId, note: d.note, bookOnline: d.bookOnline };
  const row = await prisma.$transaction(async (tx) => {
    const r = id ? await tx.shortCourse.update({ where: { id }, data })
      : await tx.shortCourse.create({ data: { ...data, typeId, orgId: at.site.orgId, siteId, createdById: at.actor.id, createdByName: at.actor.name } });
    if (schedule) {
      await tx.shortCourseSession.createMany({ data: schedule.dates.map((date) => ({ courseId: r.id, date: parseDateOnly(date), startMinutes: schedule.start, endMinutes: schedule.end, place: d.place })) });
    }
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "ShortCourse", entityId: r.id, clubId: siteId,
      summary: id ? `Changed the ${type.name} course at ${at.site.name}: ${d.capacity} places, instructor ${instructor.name}${d.bookOnline ? ", open for online booking" : ", not online"}`
        : `Put on ${type.name} at ${at.site.name}: ${d.weeks} weekly sessions from ${d.firstDay}, ${d.start}–${d.end}${d.place ? ` in ${d.place}` : ""}, ${d.capacity} places, instructor ${instructor.name}${d.bookOnline ? ", open for online booking" : ""}` }, tx);
    return r;
  });
  refresh(row.id);
  return { ok: true, id: row.id };
}

/** Mark a course finished or cancelled, or open it again. */
export async function setCourseStatus(id: string, status: "planned" | "finished" | "cancelled"): Promise<ActionResult> {
  const at = await courseFor(id, "short-courses.manage");
  if (!at.ok) return fail(at.error);
  await prisma.$transaction(async (tx) => {
    await tx.shortCourse.update({ where: { id }, data: { status, cancelledAt: status === "cancelled" ? new Date() : null } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: status === "cancelled" ? "delete" : "update", entity: "ShortCourse", entityId: id, clubId: at.site.id,
      summary: `${status === "cancelled" ? "Cancelled" : status === "finished" ? "Finished" : "Reopened"} the ${at.course.type.name} course at ${at.site.name}` }, tx);
  });
  refresh(id);
  return ok();
}

/* ---------- Sessions ---------- */

const sessionSchema = z.object({
  date: z.string().refine(isDateOnly, "Choose the day."),
  start: z.string(),
  end: z.string(),
  place: z.string().trim().max(80).default(""),
  note: z.string().trim().max(200).default(""),
});
export type SessionInput = z.input<typeof sessionSchema>;

/** Move one week (a bank holiday), or add an extra session. It shows on the Rota. */
export async function saveSession(courseId: string, id: string | null, input: SessionInput): Promise<ActionResult> {
  const at = await courseFor(courseId, "short-courses.manage");
  if (!at.ok) return fail(at.error);
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const start = clockOf(d.start), end = clockOf(d.end);
  if (start === null || end === null) return fail("Use times like 18:30.");
  if (end <= start) return fail("The session ends before it starts.");
  const before = id ? await prisma.shortCourseSession.findFirst({ where: { id, courseId }, select: { place: true } }) : null;
  if (id && !before) return fail("That session is no longer on the course.");
  const problem = await areaProblem(at.site.id, d.place, before?.place);
  if (problem) return fail(problem);
  const data = { date: parseDateOnly(d.date), startMinutes: start, endMinutes: end, place: d.place, note: d.note };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.shortCourseSession.update({ where: { id }, data }) : await tx.shortCourseSession.create({ data: { ...data, courseId } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "ShortCourseSession", entityId: row.id, clubId: at.site.id,
      summary: `${id ? "Changed" : "Added"} a ${at.course.type.name} session on ${d.date}, ${d.start}–${d.end}${d.place ? `, ${d.place}` : ""}` }, tx);
  });
  refresh(courseId);
  return ok();
}

export async function removeSession(id: string): Promise<ActionResult> {
  const s = await prisma.shortCourseSession.findFirst({ where: { id }, select: { courseId: true, date: true, registerAt: true } });
  if (!s) return fail("That session is no longer on the course.");
  const at = await courseFor(s.courseId, "short-courses.manage");
  if (!at.ok) return fail(at.error);
  if (s.registerAt) return fail("Its register has been taken. Keep it; change its day instead if it moved.");
  await prisma.$transaction(async (tx) => {
    await tx.shortCourseSession.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "ShortCourseSession", entityId: id, clubId: at.site.id, summary: `Removed the ${at.course.type.name} session on ${iso(s.date)}` }, tx);
  });
  refresh(s.courseId);
  return ok();
}

/* ---------- People ---------- */

const personSchema = z.object({
  name: z.string().trim().min(2, "Give their name.").max(120),
  email: z.string().trim().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Check the email address.").default(""),
  phone: z.string().trim().max(40).default(""),
  dateOfBirth: optionalDate,
  payment: z.enum(SHORT_COURSE_PAYMENTS as [string, ...string[]]).default("owed"),
  paid: z.string().trim().default(""),
  healthFormOn: optionalDate,
  note: z.string().trim().max(500).default(""),
  /** A new person only: put them on the waiting list rather than in a place. */
  waiting: z.boolean().default(false),
});
export type PersonInput = z.input<typeof personSchema>;

/** Book someone on a course, or put them on its waiting list when it is full; or change their
 *  details and payment. Payment is taken at the till and recorded here. */
export async function saveParticipant(courseId: string, id: string | null, input: PersonInput): Promise<ActionResult> {
  const at = await courseFor(courseId, "short-courses.read");
  if (!at.ok) return fail(at.error);
  if (at.course.cancelledAt) return fail("This course is cancelled.");
  if (!id && at.course.status !== "planned") return fail("This course has finished. Reopen it to book someone on.");
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const cents = centsOf(d.paid || "0");
  if (cents === null) return fail("Give the amount paid like 45 or 45.00.");
  const [course, before] = await Promise.all([
    prisma.shortCourse.findUniqueOrThrow({ where: { id: courseId }, select: { priceCents: true, type: { select: { minAge: true } }, sessions: { orderBy: { date: "asc" }, take: 1, select: { date: true } } } }),
    id ? prisma.shortCourseParticipant.findFirst({ where: { id, courseId }, select: { status: true } }) : null,
  ]);
  if (id && !before) return fail("They are no longer on this course.");
  const firstDay = course.sessions[0] ? iso(course.sessions[0].date) : null;
  if (course.type.minAge && d.dateOfBirth && ageOn(d.dateOfBirth, firstDay ?? today()) < course.type.minAge) {
    return fail(`They are ${ageOn(d.dateOfBirth, firstDay ?? today())} on the first day; the course is for ${course.type.minAge} and over.`);
  }
  const paidCents = d.payment === "paid" && !d.paid ? course.priceCents : cents;
  const data = { name: d.name, email: d.email, phone: d.phone, dateOfBirth: d.dateOfBirth ? parseDateOnly(d.dateOfBirth) : null,
    payment: d.payment, paidCents, healthFormOn: d.healthFormOn ? parseDateOnly(d.healthFormOn) : null, note: d.note };
  const outcome = await prisma.$transaction(async (tx) => {
    let status = before?.status ?? "booked";
    if (!id) {
      // The course row is locked while places are counted, so the last place is never taken twice.
      await tx.$queryRaw`SELECT id FROM "short_courses_courses" WHERE id = ${courseId} FOR UPDATE`;
      const booked = await tx.shortCourseParticipant.count({ where: { courseId, status: "booked" } });
      const full = booked >= at.course.capacity;
      if (full && !d.waiting) return { error: "The course is full. Put them on the waiting list instead." };
      status = full ? "waiting" : "booked";
    }
    const row = id ? await tx.shortCourseParticipant.update({ where: { id }, data })
      : await tx.shortCourseParticipant.create({ data: { ...data, status, courseId, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "ShortCourseParticipant", entityId: row.id, clubId: at.site.id,
      summary: id ? `Changed ${d.name} on the ${at.course.type.name} course: payment ${d.payment}`
        : status === "waiting" ? `Put ${d.name} on the waiting list for the ${at.course.type.name} course` : `Booked ${d.name} on the ${at.course.type.name} course: payment ${d.payment}` }, tx);
    return { error: null };
  });
  if (outcome.error) return fail(outcome.error);
  refresh(courseId);
  return ok();
}

/** Give someone on the waiting list a place, withdraw someone (their place goes back), or put
 *  a withdrawn person back. Their record and register marks stay. */
export async function setPlace(id: string, to: "booked" | "waiting" | "withdrawn"): Promise<ActionResult> {
  const p = await prisma.shortCourseParticipant.findFirst({ where: { id }, select: { courseId: true, name: true, status: true } });
  if (!p) return fail("They are no longer on this course.");
  const at = await courseFor(p.courseId, "short-courses.read");
  if (!at.ok) return fail(at.error);
  if (at.course.cancelledAt || at.course.status !== "planned") return fail("This course is closed. Reopen it first.");
  if (p.status === to) return ok();
  const outcome = await prisma.$transaction(async (tx) => {
    if (to === "booked") {
      await tx.$queryRaw`SELECT id FROM "short_courses_courses" WHERE id = ${p.courseId} FOR UPDATE`;
      if ((await tx.shortCourseParticipant.count({ where: { courseId: p.courseId, status: "booked" } })) >= at.course.capacity) return { error: "The course is full. Withdraw someone or add a place first." };
    }
    await tx.shortCourseParticipant.update({ where: { id }, data: { status: to } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "ShortCourseParticipant", entityId: id, clubId: at.site.id,
      summary: `${to === "withdrawn" ? "Withdrew" : to === "waiting" ? "Moved to the waiting list" : p.status === "waiting" ? "Gave a place to" : "Put back"} ${p.name} ${to === "withdrawn" ? "from" : "on"} the ${at.course.type.name} course` }, tx);
    return { error: null };
  });
  if (outcome.error) return fail(outcome.error);
  refresh(p.courseId);
  return ok();
}

/* ---------- Registers ---------- */

const registerSchema = z.array(z.string().min(1)).max(200);

/** Take a session's register: who was there. Everyone booked on the course is marked, there or
 *  not; it can be changed later. */
export async function takeRegister(sessionId: string, present: z.input<typeof registerSchema>): Promise<ActionResult> {
  const s = await prisma.shortCourseSession.findFirst({ where: { id: sessionId }, select: { courseId: true, date: true } });
  if (!s) return fail("That session is no longer on the course.");
  const at = await courseFor(s.courseId, "short-courses.run");
  if (!at.ok) return fail(at.error);
  if (iso(s.date) > today()) return fail("The register opens on the day of the session.");
  const parsed = registerSchema.safeParse(present);
  if (!parsed.success) return fail("Check who was there.");
  const booked = (await prisma.shortCourseParticipant.findMany({ where: { courseId: s.courseId }, select: { id: true, status: true } }));
  const mine = new Set(booked.map((b) => b.id));
  if (parsed.data.some((pid) => !mine.has(pid))) return fail("Someone on that register is not on this course.");
  const there = new Set(parsed.data);
  const marked = booked.filter((b) => takesPlace(b.status) || there.has(b.id));
  await prisma.$transaction(async (tx) => {
    for (const b of marked) {
      const value = there.has(b.id);
      await tx.shortCourseAttendance.upsert({ where: { sessionId_participantId: { sessionId, participantId: b.id } }, create: { sessionId, participantId: b.id, present: value }, update: { present: value } });
    }
    await tx.shortCourseSession.update({ where: { id: sessionId }, data: { registerAt: new Date(), registerById: at.actor.id, registerBy: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "ShortCourseSession", entityId: sessionId, clubId: at.site.id,
      summary: `Took the register for the ${at.course.type.name} session on ${iso(s.date)}: ${there.size} of ${marked.length} there` }, tx);
  });
  refresh(s.courseId);
  return ok();
}
