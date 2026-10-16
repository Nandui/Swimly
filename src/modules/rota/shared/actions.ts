"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffIds, areasAt, departmentById, departmentIdsOf, liveSiteById, staffContact, withOneStaff, withStaff } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import { activityTypeById, activityTypeIdsIn } from "@/lib/setup/activity-types";
import { addDaysIso, clock, mondayOf, parseClock, slotProblem } from "@/modules/rota/shared/constants";
import { placeProblem } from "@/modules/rota/shared/cover";
import { lanesFrom, lanesLabel, lanesProblem } from "@/modules/rota/shared/lanes";
import { areaProblem } from "@/lib/setup/data";
import { fitsFor } from "@/modules/rota/shared/data";
import { notifyShiftChange } from "@/lib/staff-api/notify";
import { commitmentsFor, planCommitment } from "@/modules/contributions";
import { ANY_DEPARTMENT } from "@/modules/rota/shared/day";
import type { Prisma } from "@/generated/prisma/client";
import { type Allowed, CLASSES, NEEDS_REASON, allowedFor, allowedForPerson, changeSchema, iso, logLive, refresh, shared } from "@/modules/rota/shared/writes";

export type ChangeInput = z.input<typeof changeSchema>;

/** Adds an activity's name and department, from Core's activity list. */
async function withType<T extends { typeId: string }>(row: T | null) {
  if (!row) return null;
  const type = await activityTypeById(row.typeId);
  return { ...row, type: { name: type?.name ?? "Removed activity", departmentId: type?.departmentId ?? "" } };
}

/** Adds each person's name, from Core. */
async function withNames<T extends { userId: string }>(rows: T[]) {
  return (await withStaff(rows, "userId", "user")).map((row) => ({ ...row, user: { name: row.user?.name ?? "Former staff" } }));
}

/* ---------- Activities on a day ---------- */

const needSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  typeId: z.string().min(1, "Choose the activity."),
  place: z.string().trim().max(60, "Keep the place under 60 characters."),
  start: z.string(),
  end: z.string(),
  places: z.coerce.number().int().min(1, "It needs at least one member of staff.").max(20, "Up to 20 staff at once."),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").default(""),
  /** The area's lanes it takes; none for the whole area. */
  lanes: z.array(z.union([z.number(), z.string()])).max(20).default([]),
});
export type NeedInput = z.input<typeof needSchema>;

/** Add an activity to a day, or change one. Its places and times can shrink only past the
 *  people already on it: take them off first. */
export async function saveNeed(id: string | null, input: NeedInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = needSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  if (end <= start) return fail("It has to end after it starts, on the same day.");
  const slot = slotProblem(start, end);
  if (slot) return fail(slot);
  const found = await activityTypeById(data.typeId);
  const type = found && !found.archivedAt && !found.fromClasses ? found : null;
  if (!type) return fail("That activity is no longer on the list.");
  const at = await allowedFor(data.siteId, data.date, type.departmentId);
  if (!at.ok) return fail(at.error);
  if (type.orgId !== at.site.orgId) return fail("That activity is no longer on the list.");
  const existing = id ? await prisma.rotaNeed.findFirst({ where: { id, siteId: data.siteId }, select: { date: true, typeId: true, place: true, assignments: { select: { place: true, startMinutes: true, endMinutes: true } } } }).then(withType) : null;
  if (id && !existing) return fail("That activity is no longer on the plan.");
  // Where it happens is one of the site's areas (Admin, Areas).
  const where = await areaProblem(data.siteId, data.place, existing?.place);
  if (where) return fail(where);
  const lanes = lanesFrom(data.lanes);
  const laneCount = (await areasAt(data.siteId)).find((a) => a.name.toLowerCase() === data.place.toLowerCase())?.lanes ?? 0;
  const laneIssue = lanesProblem(lanes, laneCount, data.place);
  if (laneIssue) return fail(laneIssue);
  if (existing) {
    // Moving it off its own day or department is a change there too.
    const from = await allowedFor(data.siteId, iso(existing.date), existing.type.departmentId);
    if (!from.ok) return fail(from.error);
    if (iso(existing.date) !== data.date && existing.assignments.length) return fail("People are on it. Take them off before moving it to another day.");
    if (existing.assignments.some((a) => a.place > data.places)) return fail("Someone is on a place you are removing. Take them off first.");
    if (existing.assignments.some((a) => a.startMinutes < start || a.endMinutes > end)) return fail("Someone is on it outside the new times. Change their time first.");
  }
  const live = at.live || (!!existing && iso(existing.date) <= today());
  if (live && !change.reason) return fail(NEEDS_REASON);
  const whereWords = data.place ? `, ${data.place}${laneCount && lanes.length ? ` ${lanesLabel(lanes, laneCount).toLowerCase()}` : ""}` : "";
  const label = `${type.name}${whereWords}, ${data.date} ${clock(start)}–${clock(end)}`;
  await prisma.$transaction(async (tx) => {
    const values = { date: parseDateOnly(data.date), typeId: type.id, place: data.place, lanes: laneCount ? lanes : [], startMinutes: start, endMinutes: end, places: data.places, note: data.note };
    if (existing) {
      await tx.rotaNeed.update({ where: { id: id! }, data: values });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaNeed", entityId: id!, clubId: at.site.id, summary: `Changed ${label}` }, tx);
    } else {
      const created = await tx.rotaNeed.create({ data: { ...values, orgId: at.site.orgId, siteId: at.site.id, createdById: at.actor.id, createdByName: at.actor.name } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaNeed", entityId: created.id, clubId: at.site.id, summary: `Added ${label}` }, tx);
    }
    if (live) await logLive(tx, at, data.date, existing ? "changed" : "added", `${existing ? "Changed" : "Added"} ${type.name}${data.place ? `, ${data.place}` : ""}, ${clock(start)} to ${clock(end)}`, null, change);
  });
  refresh();
  return ok();
}

/** Take an activity off a day, with everyone on it. */
export async function removeNeed(id: string, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const need = await prisma.rotaNeed.findFirst({ where: { id }, select: { siteId: true, date: true, place: true, startMinutes: true, endMinutes: true, typeId: true,
    assignments: { select: { userId: true } } } }).then(withType).then(async (n) => n && { ...n, assignments: await withNames(n.assignments) });
  if (!need) return fail("That activity is no longer on the plan.");
  const date = iso(need.date);
  const at = await allowedFor(need.siteId, date, need.type.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const label = `${need.type.name}${need.place ? `, ${need.place}` : ""}, ${date} ${clock(need.startMinutes)}–${clock(need.endMinutes)}`;
  const inDay = `${need.type.name}${need.place ? `, ${need.place}` : ""}, ${clock(need.startMinutes)} to ${clock(need.endMinutes)}`;
  const tell = await shared(prisma, need.siteId, need.type.departmentId, date);
  await prisma.$transaction(async (tx) => {
    await tx.rotaNeed.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaNeed", entityId: id, clubId: at.site.id, summary: `Removed ${label}` }, tx);
    if (at.live) {
      await logLive(tx, at, date, "removed", `Removed ${inDay}`, null, change);
      for (const a of need.assignments) await logLive(tx, at, date, "removed", `${a.user.name} taken off ${inDay}`, a.userId, change, a.userId);
    }
  });
  refresh();
  if (tell) for (const a of [...new Set(need.assignments.map((x) => x.userId))]) await notifyShiftChange(a, `You are no longer on ${label} at ${at.site.name}.`);
  return ok();
}

/* ---------- People on places ---------- */

const assignSchema = z.object({
  needId: z.string().min(1),
  place: z.coerce.number().int().min(1),
  userId: z.string().min(1, "Choose who."),
  start: z.string(),
  end: z.string(),
});
export type AssignInput = z.input<typeof assignSchema>;

/** Put someone on a place of an activity for all or part of its time, or change who or when
 *  (`id`). Warnings (qualification, double booking, off that day) never refuse it. */
export async function assign(id: string | null, input: AssignInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  const slot = slotProblem(start, end);
  if (slot) return fail(slot);
  const need = await prisma.rotaNeed.findFirst({ where: { id: data.needId }, select: { id: true, siteId: true, date: true, place: true, startMinutes: true, endMinutes: true, places: true, typeId: true,
    assignments: { select: { id: true, needId: true, place: true, userId: true, startMinutes: true, endMinutes: true } } } }).then(withType);
  if (!need) return fail("That activity is no longer on the plan.");
  const date = iso(need.date);
  const at = await allowedForPerson(need.siteId, date, need.type.departmentId, data.userId);
  if (!at.ok) return fail(at.error);
  const before = id ? need.assignments.find((a) => a.id === id) : null;
  if (id && !before) return fail("That person is no longer on this activity.");
  // Swapping someone off it needs the same right over them.
  if (before && before.userId !== data.userId) {
    const off = await allowedForPerson(need.siteId, date, need.type.departmentId, before.userId);
    if (!off.ok) return fail(off.error);
  }
  const problem = placeProblem(need, need.assignments, { id: id ?? undefined, needId: need.id, place: data.place, userId: data.userId, startMinutes: start, endMinutes: end });
  if (problem) return fail(problem);
  const person = await staffContact(data.userId, at.site.orgId, { activeOnly: true });
  if (!person) return fail("That person is no longer active.");
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const what = `${need.type.name}${need.place ? `, ${need.place}` : ""}`;
  const summary = `${person.name} on ${what}, ${date} ${clock(start)}–${clock(end)}`;
  const tell = await shared(prisma, need.siteId, need.type.departmentId, date);
  const previous = before && before.userId !== person.id ? before.userId : null;
  await prisma.$transaction(async (tx) => {
    const values = { place: data.place, userId: person.id, startMinutes: start, endMinutes: end };
    if (before) await tx.rotaAssignment.update({ where: { id: before.id }, data: values });
    else await tx.rotaAssignment.create({ data: { ...values, needId: need.id, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: before ? "update" : "create", entity: "RotaAssignment", entityId: before?.id ?? null, clubId: at.site.id, summary: `Put ${summary}` }, tx);
    if (at.live) await logLive(tx, at, date, before ? "changed" : "added", `${person.name} put on ${what}, ${clock(start)} to ${clock(end)}`, person.id, change, previous);
  });
  refresh();
  if (tell) {
    await notifyShiftChange(person.id, `${before?.userId === person.id ? "Your time changed" : "You are on"} ${what} at ${at.site.name} on ${date}, ${clock(start)}–${clock(end)}.`);
    if (previous) await notifyShiftChange(previous, `You are no longer on ${what} at ${at.site.name} on ${date}.`);
  }
  return ok();
}

/** Take someone off a place; that time becomes a gap. */
export async function unassign(id: string, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const found = await prisma.rotaAssignment.findFirst({ where: { id }, select: { userId: true, startMinutes: true, endMinutes: true,
    need: { select: { siteId: true, date: true, place: true, typeId: true } } } });
  const a = found && { ...(await withOneStaff(found, "userId", "user")), need: (await withType(found.need))! };
  if (!a) return fail("That person is no longer on this activity.");
  const date = iso(a.need.date);
  const at = await allowedForPerson(a.need.siteId, date, a.need.type.departmentId, a.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const what = `${a.need.type.name}${a.need.place ? `, ${a.need.place}` : ""}`;
  const tell = await shared(prisma, a.need.siteId, a.need.type.departmentId, date);
  await prisma.$transaction(async (tx) => {
    await tx.rotaAssignment.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaAssignment", entityId: id, clubId: at.site.id, summary: `Took ${a.user?.name ?? "former staff"} off ${what}, ${date}` }, tx);
    if (at.live) await logLive(tx, at, date, "removed", `${a.user?.name ?? "Former staff"} taken off ${what}, ${clock(a.startMinutes)} to ${clock(a.endMinutes)}`, a.userId, change, a.userId);
  });
  refresh();
  if (tell) await notifyShiftChange(a.userId, `You are no longer on ${what} at ${at.site.name} on ${date}, ${clock(a.startMinutes)}–${clock(a.endMinutes)}.`);
  return ok();
}

const handOverSchema = z.object({
  userId: z.string().min(1, "Choose who covers."),
  start: z.string(),
  end: z.string(),
});
export type HandOverInput = z.input<typeof handOverSchema>;

/** Hand part of someone's time on an activity to another person (owner request, 16 October 2026:
 *  staff going "in and out" of an activity such as Functional Zone, 09:00 to 14:00 with someone
 *  else on from 10:00 to 11:00). The cover person takes that stretch of the same place; the first
 *  person keeps the time before and after it, so the activity never shows a gap. All of it at once
 *  is a swap. Warnings never refuse it, as `assign`. */
export async function handOver(assignmentId: string, input: HandOverInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = handOverSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const start = parseClock(parsed.data.start), end = parseClock(parsed.data.end);
  if (start === null || end === null) return fail("Use times like 10:00.");
  if (end <= start) return fail("The cover has to end after it starts.");
  const slot = slotProblem(start, end);
  if (slot) return fail(slot);
  const found = await prisma.rotaAssignment.findFirst({ where: { id: assignmentId }, select: { id: true, place: true, userId: true, startMinutes: true, endMinutes: true,
    need: { select: { id: true, siteId: true, date: true, place: true, typeId: true } } } });
  if (!found) return fail("That person is no longer on this activity.");
  const need = (await withType(found.need))!;
  if (start < found.startMinutes || end > found.endMinutes) return fail(`Keep the cover inside their time, ${clock(found.startMinutes)} to ${clock(found.endMinutes)}.`);
  if (parsed.data.userId === found.userId) return fail("Choose someone else to cover.");
  const date = iso(need.date);
  const at = await allowedForPerson(need.siteId, date, need.type.departmentId, parsed.data.userId);
  if (!at.ok) return fail(at.error);
  const off = await allowedForPerson(need.siteId, date, need.type.departmentId, found.userId);
  if (!off.ok) return fail(off.error);
  const [cover, first] = await Promise.all([staffContact(parsed.data.userId, at.site.orgId, { activeOnly: true }), staffContact(found.userId, at.site.orgId)]);
  if (!cover) return fail("That person is no longer active.");
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const firstName = first?.name ?? "Former staff";
  const what = `${need.type.name}${need.place ? `, ${need.place}` : ""}`;
  const whole = start === found.startMinutes && end === found.endMinutes;
  const words = `${cover.name} covers ${firstName} on ${what}, ${clock(start)} to ${clock(end)}`;
  const tell = await shared(prisma, need.siteId, need.type.departmentId, date);
  await prisma.$transaction(async (tx) => {
    const by = { createdById: at.actor.id, createdByName: at.actor.name };
    if (whole) {
      await tx.rotaAssignment.update({ where: { id: found.id }, data: { userId: cover.id } });
    } else {
      // The first person keeps what is either side of the cover: the row itself for the time
      // before (or after, when the cover starts with them), and a new row for the time after.
      const keep = [{ start: found.startMinutes, end: start }, { start: end, end: found.endMinutes }].filter((s) => s.end > s.start);
      await tx.rotaAssignment.update({ where: { id: found.id }, data: { startMinutes: keep[0].start, endMinutes: keep[0].end } });
      if (keep[1]) await tx.rotaAssignment.create({ data: { needId: need.id, place: found.place, userId: found.userId, startMinutes: keep[1].start, endMinutes: keep[1].end, ...by } });
      await tx.rotaAssignment.create({ data: { needId: need.id, place: found.place, userId: cover.id, startMinutes: start, endMinutes: end, ...by } });
    }
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaAssignment", entityId: found.id, clubId: at.site.id, summary: `${words}, ${date}` }, tx);
    if (at.live) await logLive(tx, at, date, "changed", words, cover.id, change, found.userId);
  });
  refresh();
  if (tell) {
    await notifyShiftChange(cover.id, `You cover ${what} at ${at.site.name} on ${date}, ${clock(start)}–${clock(end)}.`);
    await notifyShiftChange(found.userId, whole ? `You are no longer on ${what} at ${at.site.name} on ${date}.`
      : `${cover.name} covers you on ${what} at ${at.site.name} on ${date}, ${clock(start)}–${clock(end)}.`);
  }
  return ok();
}

const putOnSchema = needSchema.pick({ siteId: true, date: true, typeId: true, place: true, start: true, end: true, lanes: true }).extend({ userId: z.string().min(1, "Choose who.") });
export type PutOnInput = z.input<typeof putOnSchema>;

/** Put someone on any activity on the list for part of their shift, when nothing on the day
 *  needs it yet (owner report, 14 October 2026: "not all defined activities show up to select
 *  for a staff member"): adds the activity for that time with one place, and them on it. Lending
 *  rules as `assign`: whoever plans their shift may put them on another department's activity. */
export async function putOnActivity(input: PutOnInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = putOnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  if (end <= start) return fail("It has to end after it starts, on the same day.");
  const slot = slotProblem(start, end);
  if (slot) return fail(slot);
  const found = await activityTypeById(data.typeId);
  const type = found && !found.archivedAt && !found.fromClasses ? found : null;
  if (!type) return fail("That activity is no longer on the list.");
  const at = await allowedForPerson(data.siteId, data.date, type.departmentId, data.userId);
  if (!at.ok) return fail(at.error);
  if (type.orgId !== at.site.orgId) return fail("That activity is no longer on the list.");
  const where = await areaProblem(data.siteId, data.place);
  if (where) return fail(where);
  const lanes = lanesFrom(data.lanes);
  const laneCount = (await areasAt(data.siteId)).find((a) => a.name.toLowerCase() === data.place.trim().toLowerCase())?.lanes ?? 0;
  const laneIssue = lanesProblem(lanes, laneCount, data.place);
  if (laneIssue) return fail(laneIssue);
  const person = await staffContact(data.userId, at.site.orgId, { activeOnly: true });
  if (!person) return fail("That person is no longer active.");
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const what = `${type.name}${data.place.trim() ? `, ${data.place.trim()}` : ""}${laneCount && lanes.length ? ` ${lanesLabel(lanes, laneCount).toLowerCase()}` : ""}`;
  const summary = `${person.name} on ${what}, ${data.date} ${clock(start)}–${clock(end)}`;
  const tell = await shared(prisma, data.siteId, type.departmentId, data.date);
  await prisma.$transaction(async (tx) => {
    const need = await tx.rotaNeed.create({ data: { orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(data.date), typeId: type.id, place: data.place.trim(), lanes: laneCount ? lanes : [],
      startMinutes: start, endMinutes: end, places: 1, note: "", createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaNeed", entityId: need.id, clubId: at.site.id, summary: `Added ${what}, ${data.date} ${clock(start)}–${clock(end)}` }, tx);
    const made = await tx.rotaAssignment.create({ data: { needId: need.id, place: 1, userId: person.id, startMinutes: start, endMinutes: end, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaAssignment", entityId: made.id, clubId: at.site.id, summary: `Put ${summary}` }, tx);
    if (at.live) await logLive(tx, at, data.date, "added", `${person.name} put on ${what}, ${clock(start)} to ${clock(end)}`, person.id, change);
  });
  refresh();
  if (tell) await notifyShiftChange(person.id, `You are on ${what} at ${at.site.name} on ${data.date}, ${clock(start)}–${clock(end)}.`);
  return ok();
}

/** Plan who teaches a swim class on a date (owner decision, 16 October 2026: "the instructor is
 *  defined via the plan"). The swim school keeps the record and checks the class runs. Who may:
 *  the department whose plan it is done from (`departmentId`), since the classes sit on every
 *  department's plan; without one, only Run. From a department's
 *  plan the class also goes on the person's shift there: inside one already, else stretching
 *  the shift it meets, else a new part of the day (`shiftForClass`). */
export async function planTeacher(input: { siteId: string; date: string; classRef: string; userId: string | null; departmentId?: string }, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  if (!isDateOnly(input.date)) return fail("Choose a day.");
  const actor = await currentActor();
  const departmentId = input.departmentId ?? ANY_DEPARTMENT;
  const at = input.userId ? await allowedForPerson(input.siteId, input.date, departmentId, input.userId) : await allowedFor(input.siteId, input.date, departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = input.userId ? await staffContact(input.userId, at.site.orgId, { activeOnly: true }) : null;
  if (input.userId && !person) return fail("That person is no longer active.");
  const lessons = (await commitmentsFor({ siteIds: [at.site.id], from: input.date, to: input.date })).filter((c) => c.source === CLASSES);
  const lesson = lessons.find((c) => c.ref === input.classRef);
  const result = await planCommitment(CLASSES, { ref: input.classRef, siteId: at.site.id, date: input.date, userId: person?.id ?? null, by: at.actor });
  if (!result.ok) return fail(result.error);
  const what = lesson?.title ? `the ${lesson.title} swim class` : "a swim class";
  // Their shift on the plan it was done from, when this person may plan that department's day.
  const shiftAt = person && lesson && input.departmentId ? await allowedFor(at.site.id, input.date, input.departmentId) : null;
  const shifted = shiftAt?.ok && person && lesson
    ? await prisma.$transaction((tx) => shiftForClass(tx, shiftAt, input.departmentId!, person, input.date, runOf(lesson, lessons.filter((c) => c.userId === person.id))))
    : null;
  if (at.live) await prisma.$transaction((tx) => logLive(tx, at, input.date, "changed", `${person ? `${person.name} planned to teach` : "Nobody planned for"} ${what}${shifted ? `; ${shifted}` : ""}`, person?.id ?? null, change));
  refresh();
  if (person && (await shared(prisma, at.site.id, input.departmentId ?? departmentId, input.date))) {
    await notifyShiftChange(person.id, `You are teaching ${what} at ${at.site.name} on ${input.date}${lesson ? `, ${clock(lesson.startMinutes)}–${clock(lesson.endMinutes)}` : ""}.`);
  }
  return ok();
}

/** A class with the classes back to back with it (or overlapping) that the same person already
 *  teaches: one stretch of work, so their shift covers the run, not a sliver of it. */
function runOf(lesson: { startMinutes: number; endMinutes: number }, theirs: readonly { startMinutes: number; endMinutes: number }[]) {
  let start = lesson.startMinutes, end = lesson.endMinutes, grew = true;
  while (grew) {
    grew = false;
    for (const c of theirs) if (c.startMinutes <= end && c.endMinutes >= start && (c.startMinutes < start || c.endMinutes > end)) {
      start = Math.min(start, c.startMinutes); end = Math.max(end, c.endMinutes); grew = true;
    }
  }
  return { start, end };
}

/** Put a class's time (`span`, its run) on someone's shift on a department's plan at the site:
 *  nothing when one of their shifts there already holds it; else the department's shift it
 *  overlaps or meets grows to hold the run; else a new shift for the run. Never makes two of theirs
 *  overlap. Says what it did, for the day's log, or null. */
async function shiftForClass(tx: Prisma.TransactionClient, at: Extract<Allowed, { ok: true }>, departmentId: string, person: { id: string; name: string }, date: string, span: { start: number; end: number }) {
  const { start, end } = span;
  const on = parseDateOnly(date);
  const shifts = await tx.rotaPlanShift.findMany({ where: { siteId: at.site.id, date: on, userId: person.id }, orderBy: { startMinutes: "asc" }, select: { id: true, departmentId: true, startMinutes: true, endMinutes: true } });
  if (shifts.some((x) => x.startMinutes <= start && x.endMinutes >= end)) return null;
  const clashes = (from: number, to: number, except: string | null) => shifts.some((x) => x.id !== except && x.startMinutes < to && from < x.endMinutes);
  const meets = shifts.find((x) => x.departmentId === departmentId && x.startMinutes <= end && x.endMinutes >= start);
  if (meets) {
    const from = Math.min(meets.startMinutes, start), to = Math.max(meets.endMinutes, end);
    if (clashes(from, to, meets.id)) return null;
    await tx.rotaPlanShift.update({ where: { id: meets.id }, data: { startMinutes: from, endMinutes: to } });
    const summary = `${person.name}'s shift now ${clock(from)} to ${clock(to)}`;
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaPlanShift", entityId: meets.id, clubId: at.site.id,
      summary: `${summary} on ${date} for a swim class (was ${clock(meets.startMinutes)}–${clock(meets.endMinutes)})` }, tx);
    return summary;
  }
  if (clashes(start, end, null)) return null;
  const row = await tx.rotaPlanShift.create({ data: { orgId: at.site.orgId, siteId: at.site.id, departmentId, date: on, userId: person.id, startMinutes: start, endMinutes: end, createdById: at.actor.id, createdByName: at.actor.name } });
  const summary = `${person.name} on a shift ${clock(start)} to ${clock(end)}`;
  await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaPlanShift", entityId: row.id, clubId: at.site.id, summary: `Put ${summary} on ${date} for a swim class` }, tx);
  return summary;
}

/** "Who can fill it" for a gap, best fit first, for the sheet. Reading, so View is enough. */
export async function whoCanFill(input: { siteId: string; date: string; start: number; end: number; typeId: string }) {
  if (!isDateOnly(input.date)) return [];
  const type = await activityTypeById(input.typeId);
  return fitsFor({ siteId: input.siteId, date: input.date, start: input.start, end: input.end, requiredTypeId: type?.requiredTypeId ?? null });
}

/* ---------- Copy and share ---------- */

const copySchema = z.object({
  siteId: z.string().min(1),
  departmentId: z.string().min(1),
  from: z.string().refine(isDateOnly, "Choose what to copy."),
  to: z.string().refine(isDateOnly, "Choose where to copy it."),
  days: z.union([z.literal(1), z.literal(7)]),
  /** Copy who is on each place too, or only the activities. */
  people: z.boolean(),
});
export type CopyInput = z.input<typeof copySchema>;

/** Copy a day or a week of one department onto days that have nothing of that department yet.
 *  Days already planned are left alone, so copying never overwrites work. */
export async function copyPlan(input: CopyInput): Promise<ActionResult> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { siteId, departmentId, from, to, days, people } = parsed.data;
  if (from === to) return fail("Choose a different day to copy from.");
  const targets = Array.from({ length: days }, (_, i) => addDaysIso(to, i));
  const checks = await Promise.all(targets.map((d) => allowedFor(siteId, d, departmentId)));
  const refused = checks.find((c) => !c.ok);
  if (refused && !refused.ok) return fail(refused.error);
  const at = checks[0] as Extract<Allowed, { ok: true }>;
  const [liveTypes, allTypes] = await Promise.all([activityTypeIdsIn(departmentId, { liveOnly: true }), activityTypeIdsIn(departmentId)]);
  const found = await prisma.rotaNeed.findMany({
    where: { siteId, typeId: { in: liveTypes }, date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, days - 1)) } },
    select: { date: true, typeId: true, place: true, lanes: true, startMinutes: true, endMinutes: true, places: true, note: true,
      assignments: { select: { place: true, userId: true, startMinutes: true, endMinutes: true } } },
  });
  const active = await activeStaffIds(found.flatMap((n) => n.assignments.map((a) => a.userId)));
  const source = found.map((n) => ({ ...n, assignments: n.assignments.filter((a) => active.has(a.userId)) }));
  if (!source.length) return fail("There is nothing of this department to copy on those days.");
  const busy = new Set((await prisma.rotaNeed.findMany({ where: { siteId, typeId: { in: allTypes }, date: { in: targets.map(parseDateOnly) } }, select: { date: true } })).map((n) => iso(n.date)));
  const offset = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  let copied = 0;
  await prisma.$transaction(async (tx) => {
    for (const n of source) {
      const date = addDaysIso(iso(n.date), offset);
      if (busy.has(date)) continue;
      await tx.rotaNeed.create({ data: {
        orgId: at.site.orgId, siteId, date: parseDateOnly(date), typeId: n.typeId, place: n.place, lanes: n.lanes, startMinutes: n.startMinutes, endMinutes: n.endMinutes, places: n.places, note: n.note,
        createdById: at.actor.id, createdByName: at.actor.name,
        ...(people ? { assignments: { create: n.assignments.map((a) => ({ place: a.place, userId: a.userId, startMinutes: a.startMinutes, endMinutes: a.endMinutes, createdById: at.actor.id, createdByName: at.actor.name })) } } : {}),
      } });
      copied += 1;
    }
    // With people, their planned shifts come too.
    if (people) {
      const shifts = await tx.rotaPlanShift.findMany({ where: { siteId, departmentId, date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, days - 1)) } },
        select: { date: true, userId: true, startMinutes: true, endMinutes: true } });
      const working = await activeStaffIds(shifts.map((x) => x.userId), tx);
      const fresh = shifts.filter((x) => working.has(x.userId) && !busy.has(addDaysIso(iso(x.date), offset)));
      if (fresh.length) await tx.rotaPlanShift.createMany({ data: fresh.map((x) => ({ orgId: at.site.orgId, siteId, departmentId, date: parseDateOnly(addDaysIso(iso(x.date), offset)),
        userId: x.userId, startMinutes: x.startMinutes, endMinutes: x.endMinutes, createdById: at.actor.id, createdByName: at.actor.name })) });
    }
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaNeed", entityId: null, clubId: siteId,
      summary: `Copied ${copied} activities${people ? " with their people" : ""} from ${from} to ${to} at ${at.site.name}` }, tx);
  });
  if (!copied) return fail("Those days are already planned. Copying only fills days with nothing on them.");
  refresh();
  return ok();
}

/** Share a department's week with its staff: they see it in Turnfin Me and are told once. */
export async function shareWeek(input: { siteId: string; departmentId: string; monday: string }): Promise<ActionResult> {
  if (!isDateOnly(input.monday) || mondayOf(input.monday) !== input.monday) return fail("Choose a week.");
  const site = await liveSiteById(input.siteId);
  if (!site?.orgId) return fail("That site is not open.");
  const actor = await currentActor();
  const resource = { siteId: site.id, orgId: site.orgId };
  const run = await mayFor("rota.manage", resource);
  const member = (await departmentIdsOf(actor.id)).includes(input.departmentId);
  if (!run && !((await mayFor("rota.plan", resource)) && member)) return fail("You share only the weeks of the departments you plan.");
  const department = await departmentById(input.departmentId, site.orgId, { liveOnly: false });
  if (!department) return fail("That department no longer exists.");
  const monday = parseDateOnly(input.monday);
  const existing = await prisma.rotaWeekShare.findUnique({ where: { siteId_departmentId_monday: { siteId: site.id, departmentId: input.departmentId, monday } }, select: { id: true } });
  if (existing) return ok();
  await prisma.$transaction(async (tx) => {
    await tx.rotaWeekShare.create({ data: { siteId: site.id, departmentId: input.departmentId, monday, sharedById: actor.id, sharedByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaWeekShare", entityId: null, clubId: site.id, summary: `Shared ${department.name}'s week of ${input.monday} at ${site.name}` }, tx);
  });
  const people = await prisma.rotaAssignment.findMany({
    where: { need: { siteId: site.id, typeId: { in: await activityTypeIdsIn(input.departmentId) }, date: { gte: monday, lte: parseDateOnly(addDaysIso(input.monday, 6)) } } },
    distinct: ["userId"], select: { userId: true },
  });
  const onShift = await prisma.rotaPlanShift.findMany({ where: { siteId: site.id, departmentId: input.departmentId, date: { gte: monday, lte: parseDateOnly(addDaysIso(input.monday, 6)) } }, distinct: ["userId"], select: { userId: true } });
  for (const p of onShift) if (!people.some((x) => x.userId === p.userId)) people.push(p);
  refresh();
  for (const p of people) await notifyShiftChange(p.userId, `Your ${department.name} rota for the week of ${input.monday} at ${site.name} is ready.`);
  return ok();
}
