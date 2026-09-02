"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireSession } from "@/lib/authz";
import { CLUB_COOKIE } from "@/lib/clubs/constants";
import { prisma } from "@/lib/prisma";

/** Choosing which club to look at. Not audited: it changes what one person
 *  sees on one device, and no data.
 *
 *  By default it lands on the overview, because the page somebody was on
 *  belonged to the other club and would only tell them so. `stay` is for the
 *  page that has already told them and offers the switch as the way through. */
export async function switchClub(
  id: string,
  options: { stay?: boolean } = {}
): Promise<ActionResult> {
  await requireSession();

  const club = await prisma.club.findFirst({
    where: { id, archivedAt: null },
    select: { id: true },
  });
  if (!club) return fail("That club is not available.");

  (await cookies()).set(CLUB_COOKIE, club.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  if (!options.stay) redirect("/");
  return ok();
}

const clubSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the club a name.")
    .max(80, "Keep the name under 80 characters."),
});

export type ClubInput = z.infer<typeof clubSchema>;

export async function createClub(input: ClubInput): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name } = parsed.data;

  const last = await prisma.club.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () =>
      prisma.club.create({
        data: { name, sortOrder: (last?.sortOrder ?? -1) + 1 },
        select: { id: true, name: true },
      }),
    `There is already a club called ${name}.`
  );
  if ("ok" in created) return created;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "Club",
    entityId: created.id,
    clubId: created.id,
    summary: `Created club ${created.name}`,
  });

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}

export async function updateClub(id: string, input: ClubInput): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name } = parsed.data;

  const existing = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) return fail("That club no longer exists.");
  if (existing.name === name) return ok();

  const updated = await onUniqueViolation(
    () =>
      prisma.club.update({
        where: { id },
        data: { name },
        select: { id: true, name: true },
      }),
    `There is already a club called ${name}.`
  );
  if ("ok" in updated) return updated;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "update",
    entity: "Club",
    entityId: id,
    clubId: id,
    summary: `Renamed club ${existing.name} → ${updated.name}`,
  });

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}

/** Archive rather than delete: a retired site still has to explain the
 *  swimmers, classes and results recorded under it. It leaves the switcher;
 *  anyone still pointed at it lands on the first live club. */
export async function setClubArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const existing = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!existing) return fail("That club no longer exists.");
  if (Boolean(existing.archivedAt) === archived) return ok();

  if (archived) {
    const others = await prisma.club.count({ where: { archivedAt: null, id: { not: id } } });
    if (others === 0) return fail("Swimly needs at least one club. Add another before archiving this one.");
  }

  await prisma.club.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: archived ? "archive" : "restore",
    entity: "Club",
    entityId: id,
    clubId: id,
    summary: `${archived ? "Archived" : "Restored"} club ${existing.name}`,
  });

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}
