"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Kinds of assessment are part of a programme's shape, so they share the
 *  curriculum's permission and live on the programme page beside its levels. */

const typeSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
});

export type AssessmentTypeInput = z.infer<typeof typeSchema>;

function revalidate() {
  revalidatePath("/programmes/[id]", "page");
  revalidatePath("/assessments");
  revalidatePath("/assessments/[id]", "page");
}

export async function createAssessmentType(
  programmeId: string,
  input: AssessmentTypeInput
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!programme) return fail("That programme no longer exists.");
  if (programme.archivedAt) return fail(`${programme.name} is archived. Restore it first.`);

  const last = await prisma.assessmentType.findFirst({
    where: { programmeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () =>
      prisma.assessmentType.create({
        data: {
          programmeId,
          name,
          description: description || null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true },
      }),
    `${programme.name} already has an assessment type called ${name}.`
  );
  if ("ok" in created) return created;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "AssessmentType",
    entityId: created.id,
    programmeId,
    summary: `Added assessment type ${created.name} to ${programme.name}`,
  });

  revalidate();
  return ok();
}

export async function updateAssessmentType(
  id: string,
  input: AssessmentTypeInput
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const existing = await prisma.assessmentType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      programmeId: true,
      programme: { select: { name: true } },
    },
  });
  if (!existing) return fail("That assessment type no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if ((existing.description ?? "") !== description) changes.push("description");

  const updated = await onUniqueViolation(
    () =>
      prisma.assessmentType.update({
        where: { id },
        data: { name, description: description || null },
        select: { id: true, name: true },
      }),
    `${existing.programme.name} already has an assessment type called ${name}.`
  );
  if ("ok" in updated) return updated;

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "AssessmentType",
      entityId: id,
      programmeId: existing.programmeId,
      summary: `Updated assessment type ${updated.name} in ${existing.programme.name} (${changes.join(", ")})`,
    });
  }

  revalidate();
  return ok();
}

/** Archived, never deleted: a past session keeps saying what kind it was. An
 *  archived type stops being offered for new sessions and nothing else. */
export async function setAssessmentTypeArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const existing = await prisma.assessmentType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      programmeId: true,
      programme: { select: { name: true } },
    },
  });
  if (!existing) return fail("That assessment type no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  await prisma.assessmentType.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: archived ? "archive" : "restore",
    entity: "AssessmentType",
    entityId: id,
    programmeId: existing.programmeId,
    summary: `${archived ? "Archived" : "Restored"} assessment type ${existing.name} in ${existing.programme.name}`,
  });

  revalidate();
  return ok();
}
