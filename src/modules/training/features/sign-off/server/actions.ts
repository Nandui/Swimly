"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { withOneStaff } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { grantQualification } from "@/modules/training/shared/grant";
import { refresh, text } from "@/modules/training/shared/writes";

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
    const row = await withOneStaff(await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { userId: true, course: { select: { title: true } } } }), "userId", "user", tx);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "sign-off", entity: "TrainingAssignment", entityId: id, summary: `Signed off ${row.course.title} for ${row.user?.name ?? "former staff"}` }, tx);
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
    const row = await withOneStaff(await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { userId: true, course: { select: { title: true } } } }), "userId", "user", tx);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "return", entity: "TrainingAssignment", entityId: id, summary: `Did not sign off ${row.course.title} for ${row.user?.name ?? "former staff"} yet: ${signoffNote}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off", `/training/people/${target.userId}`);
  return result;
}
