"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { liveSharedLevel, readSharedCurriculum } from "@/modules/activities/shared/curriculum/data/shared";
import { fullName } from "@/modules/activities/shared/students/constants";

const addSchema = z.object({
  studentId: z.string().min(1, "Pick a swimmer.").max(100),
  levelId: z.string().min(1, "Pick the level they should start at.").max(100),
  reason: z.string().trim().min(1, "Say why they are being added by hand.").max(300, "Keep the reason under 300 characters."),
});
const removeSchema = z.object({
  id: z.string().min(1).max(100),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters."),
});
export type ManualPlacementInput = z.infer<typeof addSchema>;
export type RemoveManualPlacementInput = z.infer<typeof removeSchema>;

function revalidate(studentId: string) {
  revalidatePath("/awaiting-enrolment");
  revalidatePath(`/students/${studentId}`);
}

/** Puts a swimmer on this site's Awaiting enrolment list at a level, without an
 *  assessment. Adding them again for the same programme replaces the earlier
 *  hand-added entry, so the list never shows two for one family. The swimmer's
 *  history says it was added by hand, by whom and why. */
export async function addManualPlacement(input: ManualPlacementInput): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, levelId, reason } = parsed.data;
  const clubId = await currentClubId();
  const actorName = actor.user.name ?? "Staff member";
  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.student.findUnique({ where: { id: studentId }, select: { id: true, firstName: true, lastName: true, status: true } });
    if (!student) return fail("That swimmer no longer exists.");
    if (student.status !== "ACTIVE") return fail(`${fullName(student)} is marked inactive.`);
    const curriculum = await readSharedCurriculum(tx);
    const level = liveSharedLevel(curriculum, levelId);
    if (!level) return fail("That level or its programme is archived or no longer exists.");
    const programmeIds = curriculum.programmeIds.variants(level.programmeId);
    const active = await tx.enrolment.findFirst({ where: { studentId, programmeId: { in: programmeIds }, status: "ACTIVE" }, select: { id: true } });
    if (active) return fail(`${fullName(student)} already has a ${level.programme.name} class. To move them, use Awaiting moves or their profile.`);
    const replaced = await tx.manualPlacement.updateMany({
      where: { studentId, clubId, programmeId: { in: programmeIds }, removedAt: null },
      data: { removedAt: new Date(), removedById: actor.user.id, removedByName: actorName, removedReason: "Added again" },
    });
    const row = await tx.manualPlacement.create({
      data: { clubId, studentId, programmeId: level.programmeId, levelId: level.id, reason, addedById: actor.user.id, addedByName: actorName },
      select: { id: true },
    });
    await logAudit({
      actorId: actor.user.id, actorName, action: "add-awaiting", entity: "Student", entityId: studentId,
      programmeId: level.programmeId, clubId,
      summary: `Added ${fullName(student)} to Awaiting enrolment by hand at ${level.programme.name} · ${level.name}, not from an assessment: ${reason}`,
      details: { placementId: row.id, levelId: level.id, reason, replaced: replaced.count },
    }, tx);
    return ok();
  });
  if (result.ok) revalidate(studentId);
  return result;
}

/** Takes a hand-added swimmer off the list. The entry is kept, marked removed. */
export async function removeManualPlacement(input: RemoveManualPlacementInput): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, reason } = parsed.data;
  const clubId = await currentClubId();
  const actorName = actor.user.name ?? "Staff member";
  const row = await prisma.manualPlacement.findFirst({
    where: { id, clubId },
    select: { id: true, studentId: true, programmeId: true, removedAt: true, student: { select: { firstName: true, lastName: true } } },
  });
  if (!row) return fail("That entry is not on this site's list.");
  if (row.removedAt) return ok();
  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const changed = await tx.manualPlacement.updateMany({
      where: { id, removedAt: null },
      data: { removedAt: new Date(), removedById: actor.user.id, removedByName: actorName, removedReason: reason || null },
    });
    if (!changed.count) return ok();
    await logAudit({
      actorId: actor.user.id, actorName, action: "remove-awaiting", entity: "Student", entityId: row.studentId,
      programmeId: row.programmeId, clubId,
      summary: `Took ${fullName(row.student)} off Awaiting enrolment${reason ? `: ${reason}` : ""}`,
      details: { placementId: id, reason: reason || null },
    }, tx);
    return ok();
  });
  if (result.ok) revalidate(row.studentId);
  return result;
}
