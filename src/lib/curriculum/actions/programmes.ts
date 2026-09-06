"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { LIST_ORDER } from "@/lib/curriculum/constants";
import { reorderIds } from "@/lib/curriculum/reorder";
import { prisma } from "@/lib/prisma";

/** Programme changes require curriculum.manage. */

const programmeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the programme a name.")
    .max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(400, "Keep the description under 400 characters."),
});

export type ProgrammeInput = z.infer<typeof programmeSchema>;

export async function createProgramme(input: ProgrammeInput): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = programmeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;
  // A new programme is the club being worked in's. Which is the point of the
  // switcher being on screen the whole time.
  const clubId = await currentClubId();

  const last = await prisma.programme.findFirst({
    where: { clubId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const created = await tx.programme.create({
        data: {
          clubId,
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
        entity: "Programme",
        entityId: created.id,
        programmeId: created.id,
        summary: `Created programme ${created.name}`,
      }, tx);
      return created;
    }),
    `There is already a programme called ${name} in this club.`
  );
  if ("ok" in created) return created;

  revalidatePath("/programmes");
  return ok();
}

export async function updateProgramme(
  id: string,
  input: ProgrammeInput
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = programmeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const existing = await prisma.programme.findUnique({
    where: { id, clubId: await currentClubId() },
    select: { id: true, name: true, description: true },
  });
  if (!existing) return fail("That programme no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if ((existing.description ?? "") !== description) changes.push("description");
  if (changes.length === 0) return ok();

  const updated = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const updated = await tx.programme.update({
        where: { id, clubId: await currentClubId() },
        data: { name, description: description || null },
        select: { id: true, name: true },
      });

      if (changes.length > 0) {
        await logAudit({
          actorId: session.user.id,
          actorName: session.user.name ?? "Unknown",
          action: "update",
          entity: "Programme",
          entityId: id,
          programmeId: id,
          summary: `Updated programme ${updated.name} (${changes.join(", ")})`,
        }, tx);
      }
      return updated;
    }),
    `There is already a programme called ${name}.`
  );
  if ("ok" in updated) return updated;

  revalidatePath("/programmes");
  revalidatePath("/programmes/[id]", "page");
  return ok();
}

/** Archive rather than delete: a retired programme still has to explain the
 *  levels, enrolments and completions recorded against it. */
export async function setProgrammeArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const existing = await prisma.programme.findUnique({
    where: { id, clubId: await currentClubId() },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!existing) return fail("That programme no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  if (archived) {
    const active = await prisma.enrolment.count({
      where: { programmeId: id, status: "ACTIVE" },
    });
    if (active > 0) {
      return fail(
        `${active} ${active === 1 ? "swimmer is" : "swimmers are"} still enrolled in ${existing.name}. End those enrolments first.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.programme.update({
      where: { id, clubId: await currentClubId() },
      data: { archivedAt: archived ? new Date() : null },
    });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: archived ? "archive" : "restore",
      entity: "Programme",
      entityId: id,
      programmeId: id,
      summary: `${archived ? "Archived" : "Restored"} programme ${existing.name}`,
    }, tx);
  });

  revalidatePath("/programmes");
  revalidatePath("/programmes/[id]", "page");
  return ok();
}

export async function moveProgramme(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  // Its own club's list, whichever club is being worked in.
  const moving = await prisma.programme.findUnique({ where: { id, clubId: await currentClubId() }, select: { clubId: true } });
  if (!moving) return fail("That programme no longer exists.");

  const siblings = await prisma.programme.findMany({
    where: { archivedAt: null, clubId: moving.clubId },
    orderBy: [...LIST_ORDER],
    select: { id: true, name: true },
  });

  const order = reorderIds(
    siblings.map((s) => s.id),
    id,
    direction
  );
  if (!order) return ok(); // already at the end it was asked to move toward

  const byId = new Map(siblings.map((s) => [s.id, s.name]));
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      order.map((programmeId, index) =>
        tx.programme.update({ where: { id: programmeId }, data: { sortOrder: index } })
      )
    );

    const movedTo = order.indexOf(id);
    const neighbour = order[direction === "up" ? movedTo + 1 : movedTo - 1];
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "reorder",
      entity: "Programme",
      entityId: id,
      programmeId: id,
      summary: `Moved programme ${byId.get(id)} ${direction === "up" ? "above" : "below"} ${byId.get(neighbour)}`,
    }, tx);
  });

  revalidatePath("/programmes");
  return ok();
}
