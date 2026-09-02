"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { prisma } from "@/lib/prisma";

/** Copies a programme into another club: its live levels, their live
 *  competencies, and its live kinds of assessment, in the same order.
 *
 *  Nothing else goes with it. Swimmers, classes, results and completions are
 *  the club's where they happened, and the other site enrols its own.
 *  Archived rows stay behind too — they are the source club's history, not
 *  part of the ladder as it stands.
 *
 *  One nested create, so a name clash in the target leaves nothing half-made. */
export async function copyProgramme(
  programmeId: string,
  targetClubId: string
): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");

  const [source, target] = await Promise.all([
    prisma.programme.findUnique({
      where: { id: programmeId },
      select: {
        id: true,
        name: true,
        description: true,
        clubId: true,
        club: { select: { name: true } },
        levels: {
          where: LIVE,
          orderBy: [...LIST_ORDER],
          select: {
            name: true,
            description: true,
            sortOrder: true,
            competencies: {
              where: LIVE,
              orderBy: [...LIST_ORDER],
              select: { name: true, description: true, sortOrder: true },
            },
          },
        },
        assessmentTypes: {
          where: LIVE,
          orderBy: [...LIST_ORDER],
          select: { name: true, description: true, sortOrder: true },
        },
      },
    }),
    prisma.club.findFirst({
      where: { id: targetClubId, archivedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  if (!source) return fail("That programme no longer exists.");
  if (!target) return fail("That club is not available.");
  if (source.clubId === target.id) return fail(`${source.name} is already ${target.name}'s.`);

  const last = await prisma.programme.findFirst({
    where: { clubId: target.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () =>
      prisma.programme.create({
        data: {
          clubId: target.id,
          name: source.name,
          description: source.description,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          levels: {
            create: source.levels.map((level) => ({
              name: level.name,
              description: level.description,
              sortOrder: level.sortOrder,
              competencies: {
                create: level.competencies.map((competency) => ({
                  name: competency.name,
                  description: competency.description,
                  sortOrder: competency.sortOrder,
                })),
              },
            })),
          },
          assessmentTypes: {
            create: source.assessmentTypes.map((type) => ({
              name: type.name,
              description: type.description,
              sortOrder: type.sortOrder,
            })),
          },
        },
        select: { id: true, name: true },
      }),
    `${target.name} already has a programme called ${source.name}.`
  );
  if ("ok" in created) return created;

  const competencies = source.levels.reduce((n, level) => n + level.competencies.length, 0);
  const kinds = source.assessmentTypes.length;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "Programme",
    entityId: created.id,
    programmeId: created.id,
    // The row was made in the target club, whichever one is being worked in.
    clubId: target.id,
    summary:
      `Copied programme ${source.name} from ${source.club.name} to ${target.name}: ` +
      `${source.levels.length} ${source.levels.length === 1 ? "level" : "levels"}, ` +
      `${competencies} ${competencies === 1 ? "competency" : "competencies"}` +
      (kinds ? `, ${kinds} ${kinds === 1 ? "kind" : "kinds"} of assessment` : ""),
  });

  revalidatePath("/programmes");
  return ok();
}
