"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong, organisationChart, staffByIds } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { liveQualificationTypeById } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { grantQualification } from "@/modules/training/shared/grant";
import { creditHours } from "@/modules/training/shared/hours";
import { MAX_SESSION_PLACES, readClock, sessionWhen, wallClockInstant } from "@/modules/training/shared/on-the-job";
import { refresh, text } from "@/modules/training/shared/writes";

/** Classroom and poolside sessions (e-learning phase 5).
 *  Planning one and booking people on needs Assign training; taking the
 *  register and closing it needs Sign off training for the people on it.
 *  Closing credits the hours and completes the session's course for everyone
 *  who attended. Every change is audited. */

const sessionSchema = z.object({
  title: z.string().trim().min(2, "Give the session a name.").max(120, "Keep the name under 120 characters."),
  courseId: z.string().max(64).nullable().default(null),
  siteId: z.string().max(64).nullable().default(null),
  location: z.string().trim().max(120).default(""),
  date: z.string().refine(isDateOnly, "Choose the date."),
  start: z.string().refine((v) => readClock(v) !== null, "Choose the start time."),
  minutes: z.number().int().min(5, "A session lasts at least 5 minutes.").max(1440, "A session lasts at most a day."),
  capacity: z.number().int().min(1, "Allow at least one place.").max(MAX_SESSION_PLACES).nullable().default(null),
  trainerName: z.string().trim().max(120).default(""),
  hoursTypeId: z.string().max(64).nullable().default(null),
  note: z.string().trim().max(1000).default(""),
});
export type SessionInput = z.input<typeof sessionSchema>;
type Saved = { ok: true; id: string } | Extract<ActionResult, { ok: false }>;

async function planner() {
  const who = await requireTrainingActor();
  return who.assign && who.orgId ? who as typeof who & { orgId: string } : null;
}
const NO_RIGHT = "Planning sessions needs the Assign training permission.";

export async function saveSession(sessionId: string | null, input: SessionInput): Promise<Saved> {
  const who = await planner();
  if (!who) return fail(NO_RIGHT);
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const s = parsed.data;
  const startsAt = wallClockInstant(s.date, readClock(s.start)!);
  if (!startsAt) return fail("That time doesn't exist on that day (the clocks change). Choose another.");
  if (s.siteId && !(await organisationChart()).sites.some((site) => site.id === s.siteId)) return fail("That site has been removed. Choose another.");
  if (s.hoursTypeId && !(await liveQualificationTypeById(s.hoursTypeId, who.orgId))) return fail("That qualification has been removed. Choose another.");
  const result = await prisma.$transaction(async (tx) => {
    if (s.courseId && !(await tx.trainingCourse.findFirst({ where: { id: s.courseId, orgId: who.orgId, archivedAt: null }, select: { id: true } }))) return fail("That course is no longer offered.");
    const data = { title: s.title, courseId: s.courseId, siteId: s.siteId, location: s.location, startsAt, minutes: s.minutes, capacity: s.capacity, trainerName: s.trainerName, hoursTypeId: s.hoursTypeId, note: s.note };
    let id = sessionId;
    if (sessionId) {
      const existing = await tx.trainingSession.findFirst({ where: { id: sessionId, orgId: who.orgId }, select: { registerClosedAt: true, cancelledAt: true, _count: { select: { places: true } } } });
      if (!existing) return fail("That session no longer exists.");
      if (existing.registerClosedAt || existing.cancelledAt) return fail("This session is closed and can't change.");
      if (s.capacity && existing._count.places > s.capacity) return fail(`${existing._count.places} people are booked on it already. Allow at least that many places.`);
      await tx.trainingSession.update({ where: { id: sessionId }, data });
    } else {
      id = (await tx.trainingSession.create({ data: { ...data, orgId: who.orgId, createdById: who.id, createdByName: who.name }, select: { id: true } })).id;
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: sessionId ? "update" : "create", entity: "TrainingSession", entityId: id!, summary: `${sessionId ? "Changed" : "Planned"} the session ${s.title} on ${sessionWhen(startsAt, s.minutes)}` }, tx);
    return { ok: true as const, id: id! };
  });
  if (result.ok) refresh("/training/sessions", `/training/sessions/${result.id}`);
  return result;
}

export async function cancelSession(sessionId: string, reason: string): Promise<ActionResult> {
  const who = await planner();
  if (!who) return fail(NO_RIGHT);
  const why = text(reason, 300);
  if (why.length < 3) return fail("Say briefly why it is cancelled.");
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingSession.updateMany({ where: { id: sessionId, orgId: who.orgId, cancelledAt: null, registerClosedAt: null }, data: { cancelledAt: new Date(), note: why } });
    if (moved.count !== 1) return fail("That session is already closed or cancelled.");
    const row = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId }, select: { title: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "TrainingSession", entityId: sessionId, summary: `Cancelled the session ${row.title}: ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sessions", `/training/sessions/${sessionId}`);
  return result;
}

/** Books people onto a session, within its places. */
export async function addToSession(sessionId: string, userIds: string[]): Promise<{ ok: true; added: number } | Extract<ActionResult, { ok: false }>> {
  const who = await planner();
  if (!who) return fail(NO_RIGHT);
  const ids = [...new Set(userIds.map(String))].slice(0, MAX_SESSION_PLACES);
  if (!ids.length) return fail("Choose at least one person.");
  const scope = await subjectsFor("training.assign");
  if (ids.some((id) => !filterAllows(scope, id))) return fail("You can only book the people your role covers.");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "training_sessions" WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.trainingSession.findFirst({ where: { id: sessionId, orgId: who.orgId }, select: { title: true, capacity: true, cancelledAt: true, registerClosedAt: true, places: { select: { userId: true } } } });
    if (!session) return fail("That session no longer exists.");
    if (session.cancelledAt || session.registerClosedAt) return fail("This session is closed.");
    const learners = await activeStaffAmong(who.orgId, ids, tx);
    if (learners.length !== ids.length) return fail("Someone you chose is no longer active. Refresh and try again.");
    const booked = new Set(session.places.map((p) => p.userId));
    const fresh = learners.filter((l) => !booked.has(l.id));
    if (!fresh.length) return fail(learners.length === 1 ? "They are booked on it already." : "Everyone you chose is booked on it already.");
    if (session.capacity && booked.size + fresh.length > session.capacity) return fail(`Only ${Math.max(0, session.capacity - booked.size)} ${session.capacity - booked.size === 1 ? "place is" : "places are"} left.`);
    for (const learner of fresh) {
      const place = await tx.trainingSessionPlace.create({ data: { sessionId, userId: learner.id, addedByName: who.name }, select: { id: true } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TrainingSession", entityId: sessionId, summary: `Booked ${learner.name} on the session ${session.title} (place ${place.id})` }, tx);
    }
    return { ok: true as const, added: fresh.length };
  });
  if (result.ok) refresh(`/training/sessions/${sessionId}`);
  return result;
}

async function placeFor(placeId: string, orgId: string) {
  return prisma.trainingSessionPlace.findFirst({ where: { id: placeId, session: { orgId } }, select: { id: true, userId: true, status: true, sessionId: true, session: { select: { title: true, cancelledAt: true, registerClosedAt: true, startsAt: true } } } });
}

export async function removeFromSession(placeId: string): Promise<ActionResult> {
  const who = await planner();
  if (!who) return fail(NO_RIGHT);
  const place = await placeFor(placeId, who.orgId);
  if (!place) return fail("That booking no longer exists.");
  if (!filterAllows(await subjectsFor("training.assign"), place.userId)) return fail("You can only change bookings for the people your role covers.");
  if (place.session.registerClosedAt || place.session.cancelledAt) return fail("This session is closed.");
  const result = await prisma.$transaction(async (tx) => {
    const gone = await tx.trainingSessionPlace.deleteMany({ where: { id: placeId, status: "BOOKED" } });
    if (gone.count !== 1) return fail("They are on the register already. Mark them absent instead.");
    const person = (await staffByIds([place.userId], tx)).get(place.userId);
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "TrainingSession", entityId: place.sessionId, summary: `Took ${person?.name ?? "former staff"} off the session ${place.session.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh(`/training/sessions/${place.sessionId}`);
  return result;
}

/** The register: attended or absent, changeable until the register is closed. */
export async function markPlace(placeId: string, status: "ATTENDED" | "ABSENT" | "BOOKED"): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.signoff || !who.orgId) return fail("Taking a register needs the Sign off training permission.");
  if (!["ATTENDED", "ABSENT", "BOOKED"].includes(status)) return fail("Choose attended or absent.");
  const place = await placeFor(placeId, who.orgId);
  if (!place) return fail("That booking no longer exists.");
  if (!filterAllows(await subjectsFor("training.signoff"), place.userId)) return fail("You can only take the register for the people your role covers.");
  if (place.session.registerClosedAt || place.session.cancelledAt) return fail("This register is closed.");
  if (status !== "BOOKED" && place.session.startsAt.getTime() > Date.now() + 60 * 60_000) return fail("Take the register once the session starts.");
  if (place.status === status) return ok();
  const result = await prisma.$transaction(async (tx) => {
    await tx.trainingSessionPlace.update({ where: { id: placeId }, data: { status, markedAt: status === "BOOKED" ? null : new Date() } });
    const person = (await staffByIds([place.userId], tx)).get(place.userId);
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingSession", entityId: place.sessionId, summary: `Marked ${person?.name ?? "former staff"} ${status === "ATTENDED" ? "as attended" : status === "ABSENT" ? "as absent" : "as not marked"} at ${place.session.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh(`/training/sessions/${place.sessionId}`);
  return result;
}

/** Closes the register: everyone who attended gets the hours and, when the
 *  session teaches a course, that course completed and its qualification. */
export async function closeRegister(sessionId: string): Promise<{ ok: true; attended: number } | Extract<ActionResult, { ok: false }>> {
  const who = await requireTrainingActor();
  if (!who.signoff || !who.orgId) return fail("Closing a register needs the Sign off training permission.");
  const orgId = who.orgId;
  const scope = await subjectsFor("training.signoff");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "training_sessions" WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.trainingSession.findFirst({ where: { id: sessionId, orgId }, select: {
      title: true, courseId: true, startsAt: true, minutes: true, hoursTypeId: true, cancelledAt: true, registerClosedAt: true,
      course: { select: { title: true } }, places: { select: { userId: true, status: true } },
    } });
    if (!session) return fail("That session no longer exists.");
    if (session.cancelledAt || session.registerClosedAt) return fail("This register is closed already.");
    if (session.startsAt.getTime() > Date.now()) return fail("Close the register once the session has started.");
    if (!session.places.length) return fail("Nobody is booked on this session.");
    if (session.places.some((p) => p.status === "BOOKED")) return fail("Mark everyone as attended or absent first.");
    const attended = session.places.filter((p) => p.status === "ATTENDED").map((p) => p.userId);
    if (attended.some((id) => !filterAllows(scope, id) || id === who.id)) return fail("Someone else has to close this register: it includes people you can't sign off, or you.");
    const names = await staffByIds(attended, tx);
    const type = session.hoursTypeId ? await liveQualificationTypeById(session.hoursTypeId, orgId, tx) : null;
    const on = parseDateOnly(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(session.startsAt));
    for (const userId of attended) {
      const personName = names.get(userId)?.name ?? "former staff";
      await creditHours(tx, { orgId, userId, personName, typeId: type?.id ?? null, typeName: type?.name ?? null, on, minutes: session.minutes, topic: session.title, sessionId }, who);
      if (!session.courseId) continue;
      const note = `Attended ${session.title} on ${today() === on.toISOString().slice(0, 10) ? "today" : on.toISOString().slice(0, 10)}`;
      const open = await tx.trainingAssignment.findFirst({ where: { courseId: session.courseId, userId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, select: { id: true } });
      const id = open
        ? (await tx.trainingAssignment.update({ where: { id: open.id }, data: { status: "COMPLETED", completedAt: new Date(), signedOffById: who.id, signedOffByName: who.name, signoffNote: note }, select: { id: true } })).id
        : (await tx.trainingAssignment.create({ data: { orgId, courseId: session.courseId, userId, status: "COMPLETED", completedAt: new Date(), assignedById: who.id, assignedByName: who.name, signedOffById: who.id, signedOffByName: who.name, signoffNote: note }, select: { id: true } })).id;
      await logAudit({ actorId: who.id, actorName: who.name, action: "sign-off", entity: "TrainingAssignment", entityId: id, summary: `Completed ${session.course!.title} for ${personName} at the session ${session.title}` }, tx);
      await grantQualification(tx, id, who, who);
    }
    await tx.trainingSession.update({ where: { id: sessionId }, data: { registerClosedAt: new Date(), registerClosedByName: who.name } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "close", entity: "TrainingSession", entityId: sessionId, summary: `Closed the register of ${session.title}: ${attended.length} attended, ${session.places.length - attended.length} absent` }, tx);
    return { ok: true as const, attended: attended.length };
  });
  if (result.ok) refresh("/training/sessions", `/training/sessions/${sessionId}`, "/training/hours");
  return result;
}
