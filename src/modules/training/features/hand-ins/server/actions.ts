"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { lessonPlace, readOutline } from "@/modules/training/shared/lessons";
import { refresh, text } from "@/modules/training/shared/writes";

/** A trainer's answer to work handed in (e-learning phase 8): accept it, which
 *  finishes the lesson, or send it back with what to change. Needs
 *  `training.signoff` for the person, and never on your own work. */

async function target(id: string) {
  const row = await prisma.trainingSubmission.findUnique({ where: { id }, select: { id: true, userId: true, orgId: true, assignmentId: true, lessonId: true, versionId: true, status: true } });
  if (!row) return null;
  const actor = await requireCapFor("training.signoff", { subjectUserId: row.userId, orgId: row.orgId });
  return { row, actor };
}

async function lessonTitle(versionId: string | null, lessonId: string) {
  const version = versionId ? await prisma.trainingCourseVersion.findUnique({ where: { id: versionId }, select: { outline: true } }) : null;
  return (version && lessonPlace(readOutline(version.outline), lessonId)?.lesson.title) ?? "a lesson";
}

export async function acceptHandIn(id: string, note: string): Promise<ActionResult> {
  const found = await target(id);
  if (!found) return fail("That work no longer exists.");
  const { row, actor } = found;
  if (row.userId === actor.id) return fail("Someone else has to check your own work.");
  const title = await lessonTitle(row.versionId, row.lessonId);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingSubmission.updateMany({ where: { id, status: "SUBMITTED" }, data: {
      status: "ACCEPTED", feedback: text(note, 1000), reviewedById: actor.id, reviewedByName: actor.name, reviewedAt: new Date(),
    } });
    if (moved.count !== 1) return fail("That work is no longer waiting to be checked.");
    // Accepting it finishes the lesson for them.
    const assignment = await tx.trainingAssignment.findUnique({ where: { id: row.assignmentId }, select: { status: true, course: { select: { title: true } } } });
    if (assignment?.status === "ASSIGNED") {
      await tx.trainingLessonProgress.upsert({ where: { assignmentId_lessonId: { assignmentId: row.assignmentId, lessonId: row.lessonId } }, create: { assignmentId: row.assignmentId, lessonId: row.lessonId }, update: {} });
    }
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "accept-work", entity: "TrainingAssignment", entityId: row.assignmentId,
      summary: `Accepted the work handed in for ${title}${assignment ? ` in ${assignment.course.title}` : ""}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off");
  return result;
}

export async function returnHandIn(id: string, feedback: string): Promise<ActionResult> {
  const found = await target(id);
  if (!found) return fail("That work no longer exists.");
  const { row, actor } = found;
  if (row.userId === actor.id) return fail("Someone else has to check your own work.");
  const said = text(feedback, 1000);
  if (said.length < 3) return fail("Say what to change.");
  const title = await lessonTitle(row.versionId, row.lessonId);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingSubmission.updateMany({ where: { id, status: "SUBMITTED" }, data: {
      status: "RETURNED", feedback: said, reviewedById: actor.id, reviewedByName: actor.name, reviewedAt: new Date(),
    } });
    if (moved.count !== 1) return fail("That work is no longer waiting to be checked.");
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "return-work", entity: "TrainingAssignment", entityId: row.assignmentId,
      summary: `Sent back the work handed in for ${title}: ${said.slice(0, 200)}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off");
  return result;
}
