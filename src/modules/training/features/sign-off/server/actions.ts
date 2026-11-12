"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { withOneStaff } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { grantQualification } from "@/modules/training/shared/grant";
import { observationPasses, observeSteps, practiseList, readObservation, type ObservationRecord } from "@/modules/training/shared/on-the-job";
import { refresh, text } from "@/modules/training/shared/writes";

// ---------------------------------------------------------------------------
// Completing (the learner) and signing off (a trainer)
// ---------------------------------------------------------------------------

/** What the trainer marked on the practical checklist: step id → result and note. */
export type ObservationMarks = Record<string, { result: string; note?: string }>;

async function signoffTarget(id: string) {
  const existing = await prisma.trainingAssignment.findUnique({ where: { id }, select: { userId: true, orgId: true, course: { select: { observation: true } } } });
  if (!existing) return null;
  const actor = await requireCapFor("training.signoff", { subjectUserId: existing.userId, orgId: existing.orgId });
  return { ...existing, checklist: readObservation(existing.course.observation), actor };
}

/** The observation to keep with the assignment, or a problem. A course without a checklist needs none. */
function observed(checklist: ReturnType<typeof readObservation>, marks: ObservationMarks | undefined, actor: { id: string; name: string }) {
  if (!checklist.length) return { record: null, problem: null };
  const { steps, problem } = observeSteps(checklist, marks ?? {});
  if (problem) return { record: null, problem };
  const record: ObservationRecord = { steps, observedById: actor.id, observedByName: actor.name, observedAt: new Date().toISOString() };
  return { record, problem: null };
}

export async function signOffTraining(id: string, note: string, marks?: ObservationMarks): Promise<ActionResult> {
  const target = await signoffTarget(id);
  if (!target) return fail("That training no longer exists.");
  const { actor } = target;
  if (target.userId === actor.id) return fail("Someone else has to sign off your own training.");
  const { record, problem } = observed(target.checklist, marks, actor);
  if (problem) return fail(problem);
  if (record && !observationPasses(record.steps)) return fail("Some steps are not met yet. Send it back with what to practise instead.");
  const signoffNote = text(note, 1000);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingAssignment.updateMany({ where: { id, status: "SUBMITTED" }, data: {
      status: "COMPLETED", completedAt: new Date(), signedOffById: actor.id, signedOffByName: actor.name, signoffNote,
      ...(record ? { observation: record } : {}),
    } });
    if (moved.count !== 1) return fail("That training is no longer waiting for sign-off.");
    const row = await withOneStaff(await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { userId: true, course: { select: { title: true } } } }), "userId", "user", tx);
    const seen = record ? ` against its ${record.steps.length}-step checklist` : "";
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "sign-off", entity: "TrainingAssignment", entityId: id, summary: `Signed off ${row.course.title} for ${row.user?.name ?? "former staff"}${seen}` }, tx);
    await grantQualification(tx, id, actor, actor);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off", `/training/sign-off/${id}`, `/training/people/${target.userId}`);
  return result;
}

export async function returnForPractice(id: string, note: string, marks?: ObservationMarks): Promise<ActionResult> {
  const target = await signoffTarget(id);
  if (!target) return fail("That training no longer exists.");
  const { actor } = target;
  if (target.userId === actor.id) return fail("Someone else has to sign off your own training.");
  const { record, problem } = observed(target.checklist, marks, actor);
  if (problem) return fail(problem);
  // With a checklist, the steps not met yet are what to practise, unless the trainer says more.
  const signoffNote = text(note, 1000) || (record ? text(practiseList(record.steps), 1000) : "");
  if (signoffNote.length < 3) return fail("Tell them what to practise before trying again.");
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingAssignment.updateMany({ where: { id, status: "SUBMITTED" }, data: {
      status: "ASSIGNED", submittedAt: null, signoffNote, signedOffByName: actor.name, ...(record ? { observation: record } : {}),
    } });
    if (moved.count !== 1) return fail("That training is no longer waiting for sign-off.");
    const row = await withOneStaff(await tx.trainingAssignment.findUniqueOrThrow({ where: { id }, select: { userId: true, course: { select: { title: true } } } }), "userId", "user", tx);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "return", entity: "TrainingAssignment", entityId: id, summary: `Did not sign off ${row.course.title} for ${row.user?.name ?? "former staff"} yet: ${signoffNote}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/sign-off", `/training/sign-off/${id}`, `/training/people/${target.userId}`);
  return result;
}
