"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/lib/training/access";
import { grantQualification } from "@/lib/training/self";

/** Training writes. The catalogue needs `training.manage`; assigning and
 *  cancelling need `training.assign` for that person; sign-off needs
 *  `training.signoff` for that person and is never your own. Completing your
 *  own training is not here: Work has no personal actions (see self.ts, used
 *  by the staff API for Turnfin Me). Every change is audited in the same
 *  transaction, and each status move only happens from the state it expects,
 *  so two people acting at once cannot both win. */

const refresh = (...paths: string[]) => { for (const path of ["/training", ...paths]) revalidatePath(path); };
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const courseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a name.").max(120, "Keep the name under 120 characters."),
  summary: z.string().trim().max(300, "Keep the summary under 300 characters."),
  content: z.string().trim().max(10000, "Keep the material under 10,000 characters."),
  requiresSignoff: z.boolean(),
  grantsTypeId: z.string().trim().max(64).transform((v) => v || null),
});
export type CourseInput = z.input<typeof courseSchema>;

export async function saveCourse(id: string | null, input: CourseInput): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.manage || !who.orgId) return fail("Building the catalogue needs the Training catalogue permission.");
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    if (data.grantsTypeId && !(await tx.qualificationType.findFirst({ where: { id: data.grantsTypeId, orgId: who.orgId!, archivedAt: null }, select: { id: true } }))) {
      return fail("That qualification is no longer offered.");
    }
    if (id) {
      const existing = await tx.trainingCourse.findFirst({ where: { id, orgId: who.orgId! }, select: { title: true } });
      if (!existing) return fail("That course no longer exists.");
      await tx.trainingCourse.update({ where: { id }, data });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingCourse", entityId: id, summary: `Updated the course ${data.title}` }, tx);
    } else {
      const created = await tx.trainingCourse.create({ data: { ...data, orgId: who.orgId!, createdById: who.id } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TrainingCourse", entityId: created.id, summary: `Added the course ${data.title}` }, tx);
    }
    return ok();
  }), "There is already a course with that name.", "title");
  if (result.ok) refresh("/training/courses");
  return result;
}

export async function setCourseArchived(id: string, archived: boolean): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.manage) return fail("Building the catalogue needs the Training catalogue permission.");
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { title: true, archivedAt: true } });
    if (!course) return fail("That course no longer exists.");
    if (!!course.archivedAt === archived) return ok();
    await tx.trainingCourse.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "TrainingCourse", entityId: id, summary: `${archived ? "Retired" : "Restored"} the course ${course.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/courses");
  return result;
}

// ---------------------------------------------------------------------------
// Assigning
// ---------------------------------------------------------------------------

export async function assignTraining(courseId: string, userIds: string[], dueOn: string): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.assign) return fail("Assigning training needs the Assign training permission.");
  const ids = [...new Set(userIds.map(String))].slice(0, 200);
  if (ids.length === 0) return fail("Choose at least one person.");
  if (dueOn && (!isDateOnly(dueOn) || dueOn < today())) return fail("Choose a due date from today onwards.");
  const scope = await subjectsFor("training.assign");
  if (ids.some((id) => !filterAllows(scope, id))) return fail("You can only assign training to the people your role covers.");
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId ?? undefined, archivedAt: null }, select: { title: true, orgId: true } });
    if (!course) return fail("That course is no longer offered.");
    const learners = await tx.user.findMany({ where: { id: { in: ids }, orgId: course.orgId, isActive: true }, select: { id: true, name: true } });
    if (learners.length !== ids.length) return fail("Someone you chose is no longer active. Refresh and try again.");
    const open = new Set((await tx.trainingAssignment.findMany({ where: { courseId, userId: { in: ids }, status: { in: ["ASSIGNED", "SUBMITTED"] } }, select: { userId: true } })).map((a) => a.userId));
    let assigned = 0;
    for (const learner of learners) {
      if (open.has(learner.id)) continue;
      const row = await tx.trainingAssignment.create({ data: {
        orgId: course.orgId, courseId, userId: learner.id, dueOn: dueOn ? parseDateOnly(dueOn) : null, assignedById: who.id, assignedByName: who.name,
      } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "assign", entity: "TrainingAssignment", entityId: row.id, summary: `Assigned ${course.title} to ${learner.name}${dueOn ? `, due ${dueOn}` : ""}` }, tx);
      assigned++;
    }
    if (assigned === 0) return fail(learners.length === 1 ? "They already have this course open." : "Everyone you chose already has this course open.");
    return ok();
  });
  if (result.ok) refresh(...ids.map((id) => `/training/people/${id}`));
  return result;
}

export async function cancelAssignment(id: string, reason: string): Promise<ActionResult> {
  const why = text(reason, 300);
  if (why.length < 3) return fail("Say briefly why it is no longer needed.");
  const existing = await prisma.trainingAssignment.findUnique({ where: { id }, select: { userId: true, orgId: true } });
  if (!existing) return fail("That training no longer exists.");
  const actor = await requireCapFor("training.assign", { subjectUserId: existing.userId, orgId: existing.orgId });
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingAssignment.updateMany({ where: { id, status: { in: ["ASSIGNED", "SUBMITTED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: why } });
    if (moved.count !== 1) return fail("That training is already finished or cancelled.");
    const row = await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { course: { select: { title: true } }, user: { select: { name: true } } } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "TrainingAssignment", entityId: id, summary: `Cancelled ${row.course.title} for ${row.user.name}: ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh(`/training/people/${existing.userId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Completing (the learner) and signing off (a trainer)
// ---------------------------------------------------------------------------

async function signoffTarget(id: string) {
  const existing = await prisma.trainingAssignment.findUnique({ where: { id }, select: { userId: true, orgId: true } });
  if (!existing) return null;
  const actor = await requireCapFor("training.signoff", { subjectUserId: existing.userId, orgId: existing.orgId });
  return { ...existing, actor };
}

export async function signOffTraining(id: string, note: string): Promise<ActionResult> {
  const target = await signoffTarget(id);
  if (!target) return fail("That training no longer exists.");
  const { actor } = target;
  if (target.userId === actor.id) return fail("Someone else has to sign off your own training.");
  const signoffNote = text(note, 1000);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingAssignment.updateMany({ where: { id, status: "SUBMITTED" }, data: {
      status: "COMPLETED", completedAt: new Date(), signedOffById: actor.id, signedOffByName: actor.name, signoffNote,
    } });
    if (moved.count !== 1) return fail("That training is no longer waiting for sign-off.");
    const row = await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { course: { select: { title: true } }, user: { select: { name: true } } } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "sign-off", entity: "TrainingAssignment", entityId: id, summary: `Signed off ${row.course.title} for ${row.user.name}` }, tx);
    await grantQualification(tx, id, actor, actor);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off", `/training/people/${target.userId}`);
  return result;
}

export async function returnForPractice(id: string, note: string): Promise<ActionResult> {
  const signoffNote = text(note, 1000);
  if (signoffNote.length < 3) return fail("Tell them what to practise before trying again.");
  const target = await signoffTarget(id);
  if (!target) return fail("That training no longer exists.");
  const { actor } = target;
  if (target.userId === actor.id) return fail("Someone else has to sign off your own training.");
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingAssignment.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "ASSIGNED", submittedAt: null, signoffNote, signedOffByName: actor.name } });
    if (moved.count !== 1) return fail("That training is no longer waiting for sign-off.");
    const row = await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { course: { select: { title: true } }, user: { select: { name: true } } } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "return", entity: "TrainingAssignment", entityId: id, summary: `Did not sign off ${row.course.title} for ${row.user.name} yet: ${signoffNote}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off", `/training/people/${target.userId}`);
  return result;
}
