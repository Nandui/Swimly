"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/authz";
import { LIST_ORDER } from "@/lib/curriculum/constants";
import { reorderIds } from "@/lib/curriculum/reorder";
import { prisma } from "@/lib/prisma";

/** A competency's `levelId` is deliberately not editable anywhere in this
 *  file. Moving one would retroactively rewrite who had completed the level it
 *  left and who still owes the level it joined — every past `LevelCompletion`
 *  would start disagreeing with the competencies it was measured against. The
 *  honest move is to archive it here and add a new one there. */

const competencySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Say what the swimmer has to do.")
    .max(120, "Keep it under 120 characters — the detail goes in the description."),
  description: z.string().trim().max(400, "Keep the description under 400 characters."),
});

export type CompetencyInput = z.infer<typeof competencySchema>;

export async function createCompetency(
  levelId: string,
  input: CompetencyInput
): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = competencySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const level = await prisma.level.findUnique({
    where: { id: levelId },
    select: { id: true, name: true, archivedAt: true, programmeId: true },
  });
  if (!level) return fail("That level no longer exists.");
  if (level.archivedAt) return fail(`${level.name} is archived. Restore it first.`);

  const last = await prisma.competency.findFirst({
    where: { levelId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () =>
      prisma.competency.create({
        data: {
          levelId,
          name,
          description: description || null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true },
      }),
    `${level.name} already has a competency called ${name}.`
  );
  if ("ok" in created) return created;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "Competency",
    entityId: created.id,
    programmeId: level.programmeId,
    summary: `Added competency "${created.name}" to ${level.name}`,
  });

  revalidatePath("/programmes/[id]", "page");
  return ok();
}

export async function updateCompetency(
  id: string,
  input: CompetencyInput
): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = competencySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const existing = await prisma.competency.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      level: { select: { id: true, name: true, programmeId: true } },
    },
  });
  if (!existing) return fail("That competency no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name "${existing.name}" → "${name}"`);
  if ((existing.description ?? "") !== description) changes.push("description");

  const updated = await onUniqueViolation(
    () =>
      prisma.competency.update({
        where: { id },
        data: { name, description: description || null },
        select: { id: true, name: true },
      }),
    `${existing.level.name} already has a competency called ${name}.`
  );
  if ("ok" in updated) return updated;

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "Competency",
      entityId: id,
      programmeId: existing.level.programmeId,
      summary: `Updated competency in ${existing.level.name} (${changes.join(", ")})`,
    });
  }

  revalidatePath("/programmes/[id]", "page");
  return ok();
}

/** Archiving a competency is how the curriculum changes without rewriting the
 *  past: assessments already made against it survive, and it stops counting
 *  toward anyone's eligibility from here on. */
export async function setCompetencyArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const session = await requireAdmin();

  const existing = await prisma.competency.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      level: { select: { name: true, programmeId: true } },
      _count: { select: { results: true } },
    },
  });
  if (!existing) return fail("That competency no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  await prisma.competency.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  const assessed = existing._count.results;
  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: archived ? "archive" : "restore",
    entity: "Competency",
    entityId: id,
    programmeId: existing.level.programmeId,
    summary:
      `${archived ? "Archived" : "Restored"} competency "${existing.name}" in ${existing.level.name}` +
      (assessed > 0
        ? ` (${assessed} ${assessed === 1 ? "assessment kept" : "assessments kept"})`
        : ""),
  });

  revalidatePath("/programmes/[id]", "page");
  return ok();
}

export async function moveCompetency(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const session = await requireAdmin();

  const competency = await prisma.competency.findUnique({
    where: { id },
    select: { levelId: true, name: true, level: { select: { programmeId: true } } },
  });
  if (!competency) return fail("That competency no longer exists.");

  const siblings = await prisma.competency.findMany({
    where: { levelId: competency.levelId, archivedAt: null },
    orderBy: [...LIST_ORDER],
    select: { id: true, name: true },
  });

  const order = reorderIds(
    siblings.map((s) => s.id),
    id,
    direction
  );
  if (!order) return ok();

  const byId = new Map(siblings.map((s) => [s.id, s.name]));
  await prisma.$transaction(
    order.map((competencyId, index) =>
      prisma.competency.update({ where: { id: competencyId }, data: { sortOrder: index } })
    )
  );

  const movedTo = order.indexOf(id);
  const neighbour = order[direction === "up" ? movedTo + 1 : movedTo - 1];
  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "reorder",
    entity: "Competency",
    entityId: id,
    programmeId: competency.level.programmeId,
    summary: `Moved "${competency.name}" ${direction === "up" ? "above" : "below"} "${byId.get(neighbour)}"`,
  });

  revalidatePath("/programmes/[id]", "page");
  return ok();
}
