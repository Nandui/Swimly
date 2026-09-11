"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { LIST_ORDER } from "@/lib/curriculum/constants";
import { reorderIds } from "@/lib/curriculum/reorder";
import { prepareImage } from "@/lib/curriculum/image-upload";
import { readSharedCurriculum } from "@/lib/curriculum/data/shared";
import { sharedNameTaken } from "@/lib/curriculum/shared-name";
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

export async function createProgramme(input: ProgrammeInput, imageForm?: FormData): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const parsed = programmeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;
  // Retain the registration site as provenance; this definition is shared.
  const clubId = await currentClubId();
  const image = await prepareImage(imageForm);
  if (!image.ok) return fail(image.error);

  const last = await prisma.programme.findFirst({
    where: { sharedWithId: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      if (await sharedNameTaken(tx, "programme", name, undefined)) return fail(`There is already a programme called ${name}.`);
      const created = await tx.programme.create({
        data: {
          clubId,
          name,
          description: description || null,
          ...image.data,
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
        summary: `Created programme ${created.name}${image.data.imageVersion ? " with an image" : ""}`,
      }, tx);
      return created;
    }),
    `There is already a programme called ${name} across the sites.`
  );
  if ("ok" in created) return created;
  if (image.data.imageVersion !== undefined) revalidatePath("/", "layout");

  revalidatePath("/programmes");
  return ok();
}

export async function updateProgramme(
  id: string,
  input: ProgrammeInput,
  imageForm?: FormData
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");
  const curriculum = await readSharedCurriculum();
  id = curriculum.programmeIds.resolve(id);

  const parsed = programmeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description } = parsed.data;

  const existing = await prisma.programme.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, imageVersion: true },
  });
  if (!existing) return fail("That programme no longer exists.");

  const image = await prepareImage(imageForm);
  if (!image.ok) return fail(image.error);
  const changes: string[] = [];
  if (image.data.imageVersion !== undefined && image.data.imageVersion !== existing.imageVersion) changes.push(image.data.imageVersion ? "image added or replaced" : "image removed");
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if ((existing.description ?? "") !== description) changes.push("description");
  if (changes.length === 0) return ok();

  const updated = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      if (await sharedNameTaken(tx, "programme", name, undefined, id)) return fail(`There is already a programme called ${name}.`);
      const updated = await tx.programme.update({
        where: { id },
        data: { name, description: description || null, ...image.data },
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
  if (image.data.imageVersion !== undefined) revalidatePath("/", "layout");

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
  const curriculum = await readSharedCurriculum();
  id = curriculum.programmeIds.resolve(id);

  const existing = await prisma.programme.findUnique({
    where: { id },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!existing) return fail("That programme no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  if (archived) {
    const active = await prisma.enrolment.count({
      where: { programmeId: { in: curriculum.programmeIds.variants(id) }, status: { in: ["ACTIVE", "WAITLISTED"] } },
    });
    if (active > 0) {
      return fail(
        `${active} ${active === 1 ? "swimmer is" : "swimmers are"} still enrolled in ${existing.name}. End those enrolments first.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.programme.update({
      where: { id },
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
  const curriculum = await readSharedCurriculum();
  id = curriculum.programmeIds.resolve(id);

  // One shared programme order for both sites.
  const moving = await prisma.programme.findUnique({ where: { id }, select: { clubId: true } });
  if (!moving) return fail("That programme no longer exists.");

  const siblings = await prisma.programme.findMany({
    where: { archivedAt: null, sharedWithId: null },
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
