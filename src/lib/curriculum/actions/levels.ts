"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { LIST_ORDER } from "@/lib/curriculum/constants";
import { reorderIds } from "@/lib/curriculum/reorder";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";

const levelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the level a name.")
    .max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(400, "Keep the description under 400 characters."),
});

export type LevelInput = z.infer<typeof levelSchema>;

export async function createLevel(
  programmeId: string,
  input: LevelInput
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = levelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const programme = await prisma.programme.findUnique({
    where: { id: programmeId, clubId: await currentClubId() },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!programme) return fail("That programme no longer exists.");
  if (programme.archivedAt) return fail(`${programme.name} is archived. Restore it first.`);

  const last = await prisma.level.findFirst({
    where: { programmeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const created = await tx.level.create({
        data: {
          programmeId,
          name,
          description: description || null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true },
      });

      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "create",
        entity: "Level",
        entityId: created.id,
        programmeId,
        summary: `Added level ${created.name} to ${programme.name}`,
      }, tx);
      return created;
    }),
    `${programme.name} already has a level called ${name}.`
  );
  if ("ok" in created) return created;

  revalidatePath("/programmes/[id]", "page");
  revalidatePath("/programmes");
  return ok();
}

export async function updateLevel(id: string, input: LevelInput): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = levelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const existing = await prisma.level.findUnique({
    where: { id, programme: { clubId: await currentClubId() } },
    select: {
      id: true,
      name: true,
      description: true,
      programmeId: true,
      programme: { select: { name: true } },
    },
  });
  if (!existing) return fail("That level no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if ((existing.description ?? "") !== description) changes.push("description");
  if (changes.length === 0) return ok();

  const updated = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const updated = await tx.level.update({
        where: { id, programme: { clubId: await currentClubId() } },
        data: { name, description: description || null },
        select: { id: true, name: true },
      });

      if (changes.length > 0) {
        await logAudit({
          actorId: session.user.id,
          actorName: session.user.name ?? "Unknown",
          action: "update",
          entity: "Level",
          entityId: id,
          programmeId: existing.programmeId,
          summary: `Updated level ${updated.name} in ${existing.programme.name} (${changes.join(", ")})`,
        }, tx);
      }
      return updated;
    }),
    `${existing.programme.name} already has a level called ${name}.`
  );
  if ("ok" in updated) return updated;

  revalidatePath("/programmes/[id]", "page");
  return ok();
}

export async function setLevelArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const existing = await prisma.level.findUnique({
    where: { id, programme: { clubId: await currentClubId() } },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      programmeId: true,
      programme: { select: { name: true } },
    },
  });
  if (!existing) return fail("That level no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  if (archived) {
    const courses = await prisma.course.count({
      where: { levelId: id, archivedAt: null },
    });
    if (courses > 0) {
      return fail(
        `${courses} ${courses === 1 ? "class still teaches" : "classes still teach"} ${existing.name}. Archive ${courses === 1 ? "it" : "them"} first.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.level.update({
      where: { id, programme: { clubId: await currentClubId() } },
      data: { archivedAt: archived ? new Date() : null },
    });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: archived ? "archive" : "restore",
      entity: "Level",
      entityId: id,
      programmeId: existing.programmeId,
      summary: `${archived ? "Archived" : "Restored"} level ${existing.name} in ${existing.programme.name}`,
    }, tx);
  });

  revalidatePath("/programmes/[id]", "page");
  return ok();
}

export async function moveLevel(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const level = await prisma.level.findUnique({
    where: { id, programme: { clubId: await currentClubId() } },
    select: { programmeId: true, name: true },
  });
  if (!level) return fail("That level no longer exists.");

  const siblings = await prisma.level.findMany({
    where: { programmeId: level.programmeId, archivedAt: null },
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
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      order.map((levelId, index) =>
        tx.level.update({ where: { id: levelId }, data: { sortOrder: index } })
      )
    );

    const movedTo = order.indexOf(id);
    const neighbour = order[direction === "up" ? movedTo + 1 : movedTo - 1];
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "reorder",
      entity: "Level",
      entityId: id,
      programmeId: level.programmeId,
      summary: `Moved level ${level.name} ${direction === "up" ? "above" : "below"} ${byId.get(neighbour)}`,
    }, tx);
  });

  revalidatePath("/programmes/[id]", "page");
  return ok();
}
