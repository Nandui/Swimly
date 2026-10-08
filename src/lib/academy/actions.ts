"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import { areaProblem } from "@/lib/setup/data";
import type { PermissionKey } from "@/lib/staff/permissions";
import { ACADEMY_CALL_META, ACADEMY_CALL_OUTCOMES, ACADEMY_CHECK_KEYS, ACADEMY_KINDS, ACADEMY_OUTCOMES, ACADEMY_PAYMENTS, centsOf, euro, expiryFrom, paymentFor, takesPlace } from "@/lib/academy/rules";

/** Academy writes (docs/academy.md). The course list is the organisation's (Manage); a course
 *  and everything on it is checked against its site: Manage puts courses and sessions on,
 *  Tutor (Run) adds candidates, checks, registers and results. Every write is audited. */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const optionalDate = z.string().trim().refine((v) => !v || isDateOnly(v), "Use a date like 2026-10-23.").default("");
const clockOf = (value: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function refresh(courseId?: string) {
  revalidatePath("/academy");
  revalidatePath("/academy/calls");
  if (courseId) revalidatePath(`/academy/${courseId}`);
  revalidatePath("/rota");
  revalidatePath("/rota/today");
}

/** The signed-in person, if they hold `cap` at the course's site. */
async function atSite(siteId: string, cap: PermissionKey) {
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return { ok: false as const, error: "That site is not open." };
  if (!(await mayFor(cap, { siteId, orgId: site.orgId }))) {
    return { ok: false as const, error: cap === "academy.manage" ? "Putting courses on at this site needs Academy Manage there."
      : cap === "academy.run" ? "Running courses at this site needs Academy Tutor there." : "This needs Academy access at the course's site." };
  }
  const actor = await currentActor();
  return { ok: true as const, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId } };
}

async function courseFor(id: string, cap: PermissionKey) {
  const course = await prisma.academyCourse.findFirst({ where: { id }, select: { id: true, siteId: true, capacity: true, status: true, cancelledAt: true, type: { select: { name: true } } } });
  if (!course) return { ok: false as const, error: "That course no longer exists." };
  const at = await atSite(course.siteId, cap);
  if (!at.ok) return at;
  return { ...at, course };
}

/* ---------- The course list ---------- */

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the course.").max(80),
  kind: z.enum(ACADEMY_KINDS as [string, ...string[]]),
  awardingBody: z.string().trim().max(80).default(""),
  minAge: z.union([z.literal(""), z.coerce.number().int().min(8).max(99)]).default(""),
  minHours: z.coerce.number().int().min(0).max(500).default(0),
  checks: z.array(z.enum(ACADEMY_CHECK_KEYS as [string, ...string[]])).default([]),
  qualificationTypeId: z.string().default(""),
});
export type CourseTypeInput = z.input<typeof typeSchema>;

/** Add a course we deliver ("NPLQ"), or change one. */
export async function saveCourseType(id: string | null, input: CourseTypeInput): Promise<ActionResult> {
  const session = await requirePermission("academy.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const clash = await prisma.academyCourseType.findFirst({ where: { orgId, name: { equals: d.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail("There is already a course with that name.");
  if (d.qualificationTypeId && !(await prisma.qualificationType.findFirst({ where: { id: d.qualificationTypeId, orgId }, select: { id: true } }))) return fail("That qualification is no longer offered.");
  if (d.checks.includes("age") && d.minAge === "") return fail("Give the minimum age, or untick the age check.");
  if (id && !(await prisma.academyCourseType.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That course no longer exists.");
  const data = { name: d.name, kind: d.kind, awardingBody: d.awardingBody, minAge: d.minAge === "" ? null : d.minAge, minHours: d.minHours, checks: [...new Set(d.checks)], qualificationTypeId: d.qualificationTypeId || null };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.academyCourseType.update({ where: { id }, data }) : await tx.academyCourseType.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "AcademyCourseType", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the Academy course ${d.name}` }, tx);
  });
  refresh();
  revalidatePath("/academy/courses");
  return ok();
}

export async function archiveCourseType(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("academy.manage");
  const type = await prisma.academyCourseType.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!type) return fail("That course no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.academyCourseType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "AcademyCourseType", entityId: id, clubId: null,
      summary: `${archived ? "Archived" : "Restored"} the Academy course ${type.name}` }, tx);
  });
  revalidatePath("/academy/courses");
  return ok();
}

/* ---------- Courses ---------- */

const courseSchema = z.object({
  siteId: z.string().min(1, "Choose the site."),
  typeId: z.string().min(1, "Choose the course."),
  capacity: z.coerce.number().int().min(1, "At least one place.").max(100),
  price: z.string().trim().default("0"),
  tutorId: z.string().min(1, "Choose the tutor."),
  assessorId: z.string().default(""),
  note: z.string().trim().max(500).default(""),
  bookOnline: z.boolean().default(false),
});
export type CourseInput = z.input<typeof courseSchema>;

/** Put a course on at a site, or change it. Its sessions are added on the course. */
export async function saveCourse(id: string | null, input: CourseInput): Promise<ActionResult & { id?: string }> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const before = id ? await prisma.academyCourse.findFirst({ where: { id }, select: { siteId: true, capacity: true, _count: { select: { candidates: { where: { status: { not: "withdrawn" } } } } } } }) : null;
  if (id && !before) return fail("That course no longer exists.");
  const siteId = before?.siteId ?? d.siteId;
  const at = await atSite(siteId, "academy.manage");
  if (!at.ok) return fail(at.error);
  const priceCents = centsOf(d.price || "0");
  if (priceCents === null) return fail("Give the price like 350 or 350.00.");
  if (before && d.capacity < before._count.candidates) return fail(`${before._count.candidates} people are already on it. Withdraw some first, or keep at least that many places.`);
  const [type, tutor, assessor] = await Promise.all([
    prisma.academyCourseType.findFirst({ where: { id: d.typeId, orgId: at.site.orgId, archivedAt: null }, select: { name: true } }),
    prisma.user.findFirst({ where: { id: d.tutorId, orgId: at.site.orgId, isActive: true }, select: { name: true } }),
    d.assessorId ? prisma.user.findFirst({ where: { id: d.assessorId, orgId: at.site.orgId, isActive: true }, select: { name: true } }) : null,
  ]);
  if (!type) return fail("That course is no longer on the list.");
  if (!tutor) return fail("That tutor is no longer active.");
  if (d.assessorId && !assessor) return fail("That assessor is no longer active.");
  const data = { typeId: d.typeId, capacity: d.capacity, priceCents, tutorId: d.tutorId, assessorId: d.assessorId || null, note: d.note, bookOnline: d.bookOnline };
  const row = await prisma.$transaction(async (tx) => {
    const r = id ? await tx.academyCourse.update({ where: { id }, data })
      : await tx.academyCourse.create({ data: { ...data, orgId: at.site.orgId, siteId, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "AcademyCourse", entityId: r.id, clubId: siteId,
      summary: `${id ? "Changed" : "Put on"} a ${type.name} course at ${at.site.name}: ${d.capacity} places, tutor ${tutor.name}${assessor ? `, assessor ${assessor.name}` : ""}${d.bookOnline ? ", open for online booking" : ""}` }, tx);
    return r;
  });
  refresh(row.id);
  return { ok: true, id: row.id };
}

/** Mark a course completed or cancelled, or open it again. */
export async function setCourseStatus(id: string, status: "planned" | "completed" | "cancelled"): Promise<ActionResult> {
  const at = await courseFor(id, "academy.manage");
  if (!at.ok) return fail(at.error);
  if (status === "completed") {
    const open = await prisma.academyCandidate.count({ where: { courseId: id, status: "booked" } });
    if (open) return fail(`${open} ${open === 1 ? "candidate has" : "candidates have"} no result yet. Record each result, or withdraw them, first.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.academyCourse.update({ where: { id }, data: { status, cancelledAt: status === "cancelled" ? new Date() : null } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: status === "cancelled" ? "delete" : "update", entity: "AcademyCourse", entityId: id, clubId: at.site.id,
      summary: `${status === "cancelled" ? "Cancelled" : status === "completed" ? "Completed" : "Reopened"} the ${at.course.type.name} course at ${at.site.name}` }, tx);
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

/** Add a dated session to a course, or change one. It shows on the Rota for its tutor. */
export async function saveSession(courseId: string, id: string | null, input: SessionInput): Promise<ActionResult> {
  const at = await courseFor(courseId, "academy.manage");
  if (!at.ok) return fail(at.error);
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const start = clockOf(d.start), end = clockOf(d.end);
  if (start === null || end === null) return fail("Use times like 09:00.");
  if (end <= start) return fail("The session ends before it starts.");
  const before = id ? await prisma.academySession.findFirst({ where: { id, courseId }, select: { place: true } }) : null;
  if (id && !before) return fail("That session is no longer on the course.");
  const problem = await areaProblem(at.site.id, d.place, before?.place);
  if (problem) return fail(problem);
  const data = { date: parseDateOnly(d.date), startMinutes: start, endMinutes: end, place: d.place, note: d.note };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.academySession.update({ where: { id }, data }) : await tx.academySession.create({ data: { ...data, courseId } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "AcademySession", entityId: row.id, clubId: at.site.id,
      summary: `${id ? "Changed" : "Added"} a ${at.course.type.name} session on ${d.date}, ${d.start}–${d.end}${d.place ? `, ${d.place}` : ""}` }, tx);
  });
  refresh(courseId);
  return ok();
}

export async function removeSession(id: string): Promise<ActionResult> {
  const s = await prisma.academySession.findFirst({ where: { id }, select: { courseId: true, date: true, registerAt: true } });
  if (!s) return fail("That session is no longer on the course.");
  const at = await courseFor(s.courseId, "academy.manage");
  if (!at.ok) return fail(at.error);
  if (s.registerAt) return fail("Its register has been taken. Keep it; change its time instead if it moved.");
  await prisma.$transaction(async (tx) => {
    await tx.academySession.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "AcademySession", entityId: id, clubId: at.site.id, summary: `Removed the ${at.course.type.name} session on ${iso(s.date)}` }, tx);
  });
  refresh(s.courseId);
  return ok();
}

/* ---------- Candidates ---------- */

const candidateSchema = z.object({
  userId: z.string().default(""),
  name: z.string().trim().max(120).default(""),
  email: z.string().trim().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Check the email address.").default(""),
  phone: z.string().trim().max(40).default(""),
  dateOfBirth: optionalDate,
  payment: z.enum(ACADEMY_PAYMENTS as [string, ...string[]]).default("owed"),
  paid: z.string().trim().default(""),
  note: z.string().trim().max(500).default(""),
});
export type CandidateInput = z.input<typeof candidateSchema>;

/** Put someone on a course, one of our staff or a member of the public, with the payment taken
 *  elsewhere; or change their details. Places are the course's capacity. */
export async function saveCandidate(courseId: string, id: string | null, input: CandidateInput): Promise<ActionResult> {
  const at = await courseFor(courseId, "academy.run");
  if (!at.ok) return fail(at.error);
  if (at.course.cancelledAt) return fail("This course is cancelled.");
  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const person = d.userId ? await prisma.user.findFirst({ where: { id: d.userId, orgId: at.site.orgId }, select: { id: true, name: true, email: true, dateOfBirth: true } }) : null;
  if (d.userId && !person) return fail("That staff member is no longer here.");
  const name = person?.name ?? d.name;
  if (name.length < 2) return fail("Give the candidate's name.");
  const paidCents = centsOf(d.paid || "0");
  if (paidCents === null) return fail("Give the amount paid like 150 or 150.00.");
  const before = id ? await prisma.academyCandidate.findFirst({ where: { id, courseId }, select: { id: true } }) : null;
  if (id && !before) return fail("That candidate is no longer on the course.");
  if (!id) {
    const taken = (await prisma.academyCandidate.findMany({ where: { courseId }, select: { status: true, userId: true } }));
    if (taken.filter((c) => takesPlace(c.status)).length >= at.course.capacity) return fail("The course is full. Add a place on the course first.");
    if (person && taken.some((c) => c.userId === person.id && takesPlace(c.status))) return fail(`${person.name} is already on this course.`);
  }
  const data = {
    userId: person?.id ?? null, name, email: d.email || person?.email || "", phone: d.phone,
    dateOfBirth: d.dateOfBirth ? parseDateOnly(d.dateOfBirth) : person?.dateOfBirth ?? null,
    payment: d.payment, paidCents, note: d.note,
  };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.academyCandidate.update({ where: { id }, data }) : await tx.academyCandidate.create({ data: { ...data, courseId, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: id ? "update" : "create", entity: "AcademyCandidate", entityId: row.id, clubId: at.site.id,
      summary: `${id ? "Changed" : "Put"} ${name}${person ? " (staff)" : ""} ${id ? "on" : "on"} the ${at.course.type.name} course: payment ${d.payment}` }, tx);
  });
  refresh(courseId);
  return ok();
}

/** Take someone off a course (or put them back). Their record stays, with any register marks. */
export async function setWithdrawn(id: string, withdrawn: boolean): Promise<ActionResult> {
  const c = await prisma.academyCandidate.findFirst({ where: { id }, select: { courseId: true, name: true, status: true } });
  if (!c) return fail("That candidate is no longer on the course.");
  const at = await courseFor(c.courseId, "academy.run");
  if (!at.ok) return fail(at.error);
  if (!withdrawn && (await prisma.academyCandidate.count({ where: { courseId: c.courseId, status: { not: "withdrawn" } } })) >= at.course.capacity) return fail("The course is full.");
  if (withdrawn && c.status !== "booked") return fail("They already have a result. Change the result instead.");
  await prisma.$transaction(async (tx) => {
    await tx.academyCandidate.update({ where: { id }, data: { status: withdrawn ? "withdrawn" : "booked" } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "AcademyCandidate", entityId: id, clubId: at.site.id,
      summary: `${withdrawn ? "Withdrew" : "Put back"} ${c.name} ${withdrawn ? "from" : "on"} the ${at.course.type.name} course` }, tx);
  });
  refresh(c.courseId);
  return ok();
}

const checksSchema = z.object({ swimTestOn: optionalDate, medicalOn: optionalDate, idCheckedOn: optionalDate, dateOfBirth: optionalDate });
export type ChecksInput = z.input<typeof checksSchema>;

/** Record the pre-course checks: the day each was done. */
export async function recordChecks(id: string, input: ChecksInput): Promise<ActionResult> {
  const c = await prisma.academyCandidate.findFirst({ where: { id }, select: { courseId: true, name: true } });
  if (!c) return fail("That candidate is no longer on the course.");
  const at = await courseFor(c.courseId, "academy.run");
  if (!at.ok) return fail(at.error);
  const parsed = checksSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const day = (v: string) => (v ? parseDateOnly(v) : null);
  const done = [d.swimTestOn && "swim test", d.medicalOn && "medical form", d.idCheckedOn && "photo ID"].filter(Boolean).join(", ") || "none";
  await prisma.$transaction(async (tx) => {
    await tx.academyCandidate.update({ where: { id }, data: { swimTestOn: day(d.swimTestOn), medicalOn: day(d.medicalOn), idCheckedOn: day(d.idCheckedOn), checkedByName: at.actor.name,
      ...(d.dateOfBirth ? { dateOfBirth: day(d.dateOfBirth) } : {}) } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "AcademyCandidate", entityId: id, clubId: at.site.id,
      summary: `Recorded ${c.name}'s pre-course checks on the ${at.course.type.name} course: ${done}` }, tx);
  });
  refresh(c.courseId);
  return ok();
}

/* ---------- Registers ---------- */

const registerSchema = z.array(z.object({ candidateId: z.string().min(1), minutes: z.coerce.number().int().min(0).max(1440) })).max(100);

/** Take a session's register: the minutes each candidate attended (all of it, part, or none). */
export async function takeRegister(sessionId: string, entries: z.input<typeof registerSchema>): Promise<ActionResult> {
  const s = await prisma.academySession.findFirst({ where: { id: sessionId }, select: { courseId: true, date: true, startMinutes: true, endMinutes: true } });
  if (!s) return fail("That session is no longer on the course.");
  const at = await courseFor(s.courseId, "academy.run");
  if (!at.ok) return fail(at.error);
  const parsed = registerSchema.safeParse(entries);
  if (!parsed.success) return fail("Check the minutes for each candidate.");
  const length = s.endMinutes - s.startMinutes;
  if (parsed.data.some((e) => e.minutes > length)) return fail(`The session is ${length} minutes long.`);
  const mine = new Set((await prisma.academyCandidate.findMany({ where: { courseId: s.courseId }, select: { id: true } })).map((c) => c.id));
  if (parsed.data.some((e) => !mine.has(e.candidateId))) return fail("Someone on that register is not on this course.");
  const present = parsed.data.filter((e) => e.minutes > 0).length;
  await prisma.$transaction(async (tx) => {
    for (const e of parsed.data) {
      await tx.academyAttendance.upsert({ where: { sessionId_candidateId: { sessionId, candidateId: e.candidateId } }, create: { sessionId, candidateId: e.candidateId, minutes: e.minutes }, update: { minutes: e.minutes } });
    }
    await tx.academySession.update({ where: { id: sessionId }, data: { registerAt: new Date(), registerById: at.actor.id, registerBy: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "AcademySession", entityId: sessionId, clubId: at.site.id,
      summary: `Took the register for the ${at.course.type.name} session on ${iso(s.date)}: ${present} of ${parsed.data.length} there` }, tx);
  });
  refresh(s.courseId);
  return ok();
}

/* ---------- Results ---------- */

const resultSchema = z.object({
  status: z.enum(ACADEMY_OUTCOMES),
  resultOn: z.string().refine(isDateOnly, "Choose the day of the result."),
  certificateNumber: z.string().trim().max(80).default(""),
  certificateExpires: optionalDate,
  note: z.string().trim().max(500).default(""),
});
export type ResultInput = z.input<typeof resultSchema>;

/** Record a candidate's result and the awarding body's certificate. A staff member who passes
 *  gets the course's qualification on their record (Training and HR read it); changing a pass
 *  to another result withdraws that qualification again. */
export async function recordResult(id: string, input: ResultInput): Promise<ActionResult> {
  const c = await prisma.academyCandidate.findFirst({ where: { id }, select: { courseId: true, name: true, userId: true, status: true, qualificationId: true,
    course: { select: { type: { select: { qualificationTypeId: true, qualificationType: { select: { name: true, validityMonths: true } } } } } } } });
  if (!c) return fail("That candidate is no longer on the course.");
  const at = await courseFor(c.courseId, "academy.run");
  if (!at.ok) return fail(at.error);
  if (c.status === "withdrawn") return fail("They withdrew. Put them back on the course first.");
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.status === "passed" && !d.certificateNumber) return fail("Give the certificate number from the awarding body.");
  if (d.certificateExpires && d.certificateExpires < d.resultOn) return fail("The certificate expires before the result.");
  const grants = d.status === "passed" && c.userId && c.course.type.qualificationTypeId;
  const expires = grants ? expiryFrom(d.resultOn, d.certificateExpires || null, c.course.type.qualificationType?.validityMonths ?? null) : null;
  await prisma.$transaction(async (tx) => {
    let qualificationId = c.qualificationId;
    if (grants) {
      const values = { issuedOn: parseDateOnly(d.resultOn), expiresOn: expires ? parseDateOnly(expires) : null, reference: d.certificateNumber, verifiedById: at.actor.id, verifiedAt: new Date(), revokedAt: null,
        note: `${at.course.type.name} course at ${at.site.name} (Academy)` };
      qualificationId = c.qualificationId
        ? (await tx.qualification.update({ where: { id: c.qualificationId }, data: values })).id
        : (await tx.qualification.create({ data: { ...values, orgId: at.site.orgId, userId: c.userId!, typeId: c.course.type.qualificationTypeId! } })).id;
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "Qualification", entityId: qualificationId, clubId: at.site.id,
        summary: `Recorded ${c.course.type.qualificationType?.name ?? "a qualification"} for ${c.name} from the Academy${expires ? `, valid until ${expires}` : ""}` }, tx);
    } else if (c.qualificationId) {
      await tx.qualification.update({ where: { id: c.qualificationId }, data: { revokedAt: new Date() } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "Qualification", entityId: c.qualificationId, clubId: at.site.id,
        summary: `Withdrew the Academy qualification for ${c.name}: their result changed to ${d.status}` }, tx);
      qualificationId = null;
    }
    await tx.academyCandidate.update({ where: { id }, data: {
      status: d.status, resultOn: parseDateOnly(d.resultOn), resultNote: d.note, certificateNumber: d.certificateNumber,
      certificateExpires: d.certificateExpires ? parseDateOnly(d.certificateExpires) : null, qualificationId,
    } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "AcademyCandidate", entityId: id, clubId: at.site.id,
      summary: `${c.name}: ${d.status} on the ${at.course.type.name} course${d.certificateNumber ? `, certificate ${d.certificateNumber}` : ""}` }, tx);
  });
  refresh(c.courseId);
  if (grants) revalidatePath(`/staff/${c.userId}`);
  return ok();
}

/* ---------- Phoning people who held a place online ---------- */

const callSchema = z.object({
  outcome: z.enum(ACADEMY_CALL_OUTCOMES as [string, ...string[]], { message: "Choose how the call went." }),
  amount: z.string().trim().default(""),
  receipt: z.string().trim().max(60).default(""),
  note: z.string().trim().max(300).default(""),
});
export type CallInput = z.input<typeof callSchema>;

/** Record a call to someone who held a place online (owner decision, 8 October 2026: anyone with
 *  Academy access at the course's site). Paid records the amount (the full price is paid, less a
 *  deposit) and secures the place; not going ahead withdraws them and frees it; the others stay
 *  on the list to call. */
export async function logCall(candidateId: string, input: CallInput): Promise<ActionResult> {
  const parsed = callSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const c = await prisma.academyCandidate.findFirst({ where: { id: candidateId }, select: { courseId: true, name: true, status: true, payment: true, paidCents: true, course: { select: { priceCents: true } } } });
  if (!c) return fail("That booking is no longer on the course.");
  const at = await courseFor(c.courseId, "academy.read");
  if (!at.ok) return fail(at.error);
  if (c.status !== "booked") return fail(`${c.name} is no longer booked on the course.`);
  const amountCents = d.outcome === "paid" ? centsOf(d.amount) : null;
  if (d.outcome === "paid" && (amountCents === null || (amountCents === 0 && c.course.priceCents > 0))) return fail("Give the amount taken, like 350 or 350.00.");
  const paidCents = c.paidCents + (amountCents ?? 0);
  const label = ACADEMY_CALL_META[d.outcome as keyof typeof ACADEMY_CALL_META].label.toLowerCase();
  await prisma.$transaction(async (tx) => {
    const call = await tx.academyCall.create({ data: { candidateId, outcome: d.outcome, amountCents, receipt: d.receipt, note: d.note, byId: at.actor.id, byName: at.actor.name } });
    if (d.outcome === "paid") await tx.academyCandidate.update({ where: { id: candidateId }, data: { paidCents, payment: paymentFor(paidCents, c.course.priceCents) } });
    if (d.outcome === "not-going-ahead") await tx.academyCandidate.update({ where: { id: candidateId }, data: { status: "withdrawn" } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "AcademyCall", entityId: call.id, clubId: at.site.id,
      summary: `Phoned ${c.name} about the ${at.course.type.name} course: ${label}${amountCents !== null ? `, ${euro(amountCents)} taken${d.receipt ? ` (receipt ${d.receipt})` : ""}` : ""}${d.outcome === "not-going-ahead" ? "; the place is free again" : ""}` }, tx);
  });
  refresh(c.courseId);
  return ok();
}
