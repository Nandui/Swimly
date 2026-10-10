"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong, withOneStaff } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { refresh, text } from "@/modules/training/shared/writes";

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
    const learners = await activeStaffAmong(course.orgId, ids, tx);
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
    const row = await withOneStaff(await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { userId: true, course: { select: { title: true } } } }), "userId", "user", tx);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "TrainingAssignment", entityId: id, summary: `Cancelled ${row.course.title} for ${row.user?.name ?? "former staff"}: ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh(`/training/people/${existing.userId}`);
  return result;
}
