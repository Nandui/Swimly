"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong, withOneStaff } from "@/lib/directory";
import { addDaysIso, isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { MAX_PATH_STEPS } from "@/modules/training/shared/on-the-job";
import { refresh, text } from "@/modules/training/shared/writes";

/** Learning paths (docs/training.md, e-learning phase 5): courses in order,
 *  each due some days after the person starts. Building one needs the Author
 *  level; putting people on one needs Assign training for them. Enrolling
 *  assigns every course they haven't finished; everything is audited. */

const pathSchema = z.object({
  title: z.string().trim().min(2, "Give the path a name.").max(120, "Keep the name under 120 characters."),
  summary: z.string().trim().max(500, "Keep the summary under 500 characters.").default(""),
  steps: z.array(z.object({ courseId: z.string().min(1).max(64), dueDays: z.number().int().min(0, "Due days can't be negative.").max(365, "Allow up to a year for a step.") }))
    .min(1, "Add at least one course.").max(MAX_PATH_STEPS, `Keep it to ${MAX_PATH_STEPS} courses.`),
});
export type PathInput = z.input<typeof pathSchema>;

async function author() {
  const who = await requireTrainingActor();
  return who.manage && who.orgId ? who as typeof who & { orgId: string } : null;
}

export async function savePath(pathId: string | null, input: PathInput): Promise<{ ok: true; id: string } | Extract<ActionResult, { ok: false }>> {
  const who = await author();
  if (!who) return fail("Building learning paths needs the Author level in Training.");
  const parsed = pathSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { title, summary, steps } = parsed.data;
  if (new Set(steps.map((s) => s.courseId)).size !== steps.length) return fail("Each course can be on the path once.");
  const result = await prisma.$transaction(async (tx) => {
    const courses = await tx.trainingCourse.findMany({ where: { id: { in: steps.map((s) => s.courseId) }, orgId: who.orgId, archivedAt: null }, select: { id: true } });
    if (courses.length !== steps.length) return fail("A course you chose is no longer offered. Reload and choose again.");
    const clash = await tx.trainingPath.findFirst({ where: { orgId: who.orgId, title, ...(pathId ? { id: { not: pathId } } : {}) }, select: { id: true } });
    if (clash) return fail("Another path already has that name.");
    let id = pathId;
    if (pathId) {
      const existing = await tx.trainingPath.findFirst({ where: { id: pathId, orgId: who.orgId }, select: { id: true } });
      if (!existing) return fail("That path no longer exists.");
      await tx.trainingPath.update({ where: { id: pathId }, data: { title, summary } });
      await tx.trainingPathStep.deleteMany({ where: { pathId } });
    } else {
      id = (await tx.trainingPath.create({ data: { orgId: who.orgId, title, summary, createdById: who.id, createdByName: who.name }, select: { id: true } })).id;
    }
    await tx.trainingPathStep.createMany({ data: steps.map((s, i) => ({ pathId: id!, courseId: s.courseId, position: i, dueDays: s.dueDays })) });
    await logAudit({ actorId: who.id, actorName: who.name, action: pathId ? "update" : "create", entity: "TrainingPath", entityId: id!, summary: `${pathId ? "Changed" : "Added"} the learning path ${title}: ${steps.length} ${steps.length === 1 ? "course" : "courses"}` }, tx);
    return { ok: true as const, id: id! };
  });
  if (result.ok) refresh("/training/paths", `/training/paths/${result.id}`);
  return result;
}

export async function setPathArchived(pathId: string, archived: boolean): Promise<ActionResult> {
  const who = await author();
  if (!who) return fail("Building learning paths needs the Author level in Training.");
  const result = await prisma.$transaction(async (tx) => {
    const path = await tx.trainingPath.findFirst({ where: { id: pathId, orgId: who.orgId }, select: { title: true, archivedAt: true } });
    if (!path) return fail("That path no longer exists.");
    if (!!path.archivedAt === archived) return ok();
    await tx.trainingPath.update({ where: { id: pathId }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "TrainingPath", entityId: pathId, summary: `${archived ? "Archived" : "Restored"} the learning path ${path.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/paths", `/training/paths/${pathId}`);
  return result;
}

/** Puts people on a path from a start date. Each course they haven't finished
 *  and don't have open is assigned, due the step's days after the start. */
export async function enrolInPath(pathId: string, userIds: string[], startsOn: string): Promise<{ ok: true; enrolled: number; assigned: number } | Extract<ActionResult, { ok: false }>> {
  const who = await requireTrainingActor();
  if (!who.assign || !who.orgId) return fail("Putting people on a path needs the Assign training permission.");
  const ids = [...new Set(userIds.map(String))].slice(0, 200);
  if (!ids.length) return fail("Choose at least one person.");
  if (!isDateOnly(startsOn)) return fail("Choose the date they start.");
  const scope = await subjectsFor("training.assign");
  if (ids.some((id) => !filterAllows(scope, id))) return fail("You can only put the people your role covers on a path.");
  const orgId = who.orgId;
  const result = await prisma.$transaction(async (tx) => {
    const path = await tx.trainingPath.findFirst({ where: { id: pathId, orgId, archivedAt: null }, select: { title: true, steps: { orderBy: { position: "asc" }, select: { courseId: true, dueDays: true, course: { select: { title: true, archivedAt: true } } } } } });
    if (!path) return fail("That path is no longer offered.");
    const learners = await activeStaffAmong(orgId, ids, tx);
    if (learners.length !== ids.length) return fail("Someone you chose is no longer active. Refresh and try again.");
    const already = new Set((await tx.trainingPathEnrolment.findMany({ where: { pathId, userId: { in: ids }, cancelledAt: null }, select: { userId: true } })).map((e) => e.userId));
    const steps = path.steps.filter((s) => !s.course.archivedAt);
    const history = await tx.trainingAssignment.findMany({ where: { userId: { in: ids }, courseId: { in: steps.map((s) => s.courseId) }, status: { in: ["ASSIGNED", "SUBMITTED", "COMPLETED"] } }, select: { userId: true, courseId: true } });
    let enrolled = 0, assigned = 0;
    for (const learner of learners) {
      if (already.has(learner.id)) continue;
      const enrolment = await tx.trainingPathEnrolment.create({ data: { orgId, pathId, userId: learner.id, startsOn: parseDateOnly(startsOn), enrolledById: who.id, enrolledByName: who.name }, select: { id: true } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TrainingPathEnrolment", entityId: enrolment.id, summary: `Put ${learner.name} on the learning path ${path.title}, starting ${startsOn}` }, tx);
      enrolled++;
      for (const step of steps) {
        if (history.some((h) => h.userId === learner.id && h.courseId === step.courseId)) continue;
        const dueOn = addDaysIso(startsOn, step.dueDays);
        const row = await tx.trainingAssignment.create({ data: {
          orgId, courseId: step.courseId, userId: learner.id, dueOn: parseDateOnly(dueOn), assignedById: who.id, assignedByName: who.name, pathEnrolmentId: enrolment.id,
        } });
        await logAudit({ actorId: who.id, actorName: who.name, action: "assign", entity: "TrainingAssignment", entityId: row.id, summary: `Assigned ${step.course.title} to ${learner.name} on the path ${path.title}, due ${dueOn}` }, tx);
        assigned++;
      }
    }
    if (!enrolled) return fail(learners.length === 1 ? "They are already on this path." : "Everyone you chose is already on this path.");
    return { ok: true as const, enrolled, assigned };
  });
  if (result.ok) refresh(`/training/paths/${pathId}`, ...ids.map((id) => `/training/people/${id}`));
  return result;
}

/** Takes someone off a path. Courses it assigned that they haven't started
 *  handing in are cancelled; finished ones stay on their record. */
export async function leavePath(enrolmentId: string, reason: string): Promise<ActionResult> {
  const why = text(reason, 300);
  if (why.length < 3) return fail("Say briefly why they are coming off the path.");
  const existing = await prisma.trainingPathEnrolment.findUnique({ where: { id: enrolmentId }, select: { userId: true, orgId: true, pathId: true, cancelledAt: true, path: { select: { title: true } } } });
  if (!existing) return fail("That enrolment no longer exists.");
  const actor = await requireCapFor("training.assign", { subjectUserId: existing.userId, orgId: existing.orgId });
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingPathEnrolment.updateMany({ where: { id: enrolmentId, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (moved.count !== 1) return fail("They are no longer on this path.");
    const cancelled = await tx.trainingAssignment.updateMany({ where: { pathEnrolmentId: enrolmentId, status: "ASSIGNED" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: `Taken off the path ${existing.path.title}: ${why}` } });
    const row = await withOneStaff({ userId: existing.userId }, "userId", "user", tx);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "TrainingPathEnrolment", entityId: enrolmentId, summary: `Took ${row.user?.name ?? "former staff"} off the learning path ${existing.path.title} (${cancelled.count} open ${cancelled.count === 1 ? "course" : "courses"} cancelled): ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh(`/training/paths/${existing.pathId}`, `/training/people/${existing.userId}`);
  return result;
}
