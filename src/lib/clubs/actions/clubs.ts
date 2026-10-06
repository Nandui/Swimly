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
 *  By default it lands on the role's accessible home, because the page somebody was on
 *  belonged to the other club and would only tell them so. `stay` is for the
 *  page that has already told them and offers the switch as the way through. */
export async function switchClub(
  id: string,
  options: { stay?: boolean } = {}
): Promise<ActionResult> {
  const session = await requireSession();

  const [club, person] = await Promise.all([
    prisma.club.findFirst({ where: { id, archivedAt: null }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { siteIds: true } }),
  ]);
  // Only a site the person works at (no sites means every site), as the picker lists.
  const sites = person?.siteIds ?? [];
  if (!club || (sites.length > 0 && !sites.includes(club.id))) return fail("Could not switch sites. Check the site and try again.");

  (await cookies()).set(CLUB_COOKIE, club.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  if (!options.stay) redirect("/start");
  return ok();
}

const clubSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the site a name.")
    .max(80, "Keep the name under 80 characters."),
  /** Two to four capital letters, e.g. BT. Purchase order numbers use it. */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{2,4}$/.test(v), "Use two to four letters for the short code, for example BT.")
    .transform((v) => v || null)
    .default(""),
});

export type ClubInput = z.input<typeof clubSchema>;

export async function createClub(input: ClubInput): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, code } = parsed.data;

  const last = await prisma.club.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const created = await tx.club.create({
        data: { name, code, sortOrder: (last?.sortOrder ?? -1) + 1 },
        select: { id: true, name: true },
      });

      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "create",
        entity: "Club",
        entityId: created.id,
        clubId: created.id,
        summary: `Created club ${created.name}${code ? ` (${code})` : ""}`,
      }, tx);
      return created;
    }),
    `There is already a site called ${name}${code ? `, or with the code ${code}` : ""}.`
  );
  if ("ok" in created) return created;

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}

export async function updateClub(id: string, input: ClubInput): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, code } = parsed.data;

  const existing = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, code: true },
  });
  if (!existing) return fail("That site no longer exists.");
  if (existing.name === name && existing.code === code) return ok();

  const updated = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const updated = await tx.club.update({
        where: { id },
        data: { name, code },
        select: { id: true, name: true },
      });

      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "update",
        entity: "Club",
        entityId: id,
        clubId: id,
        summary: existing.name === updated.name
          ? `Set ${updated.name}'s short code to ${code ?? "none"}`
          : `Renamed club ${existing.name} → ${updated.name}${existing.code !== code ? `, short code ${code ?? "none"}` : ""}`,
      }, tx);
      return updated;
    }),
    `There is already a site called ${name}${code ? `, or with the code ${code}` : ""}.`
  );
  if ("ok" in updated) return updated;

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}

/** Archive rather than delete: a retired site still has to explain the
 *  swimmers, classes and results recorded under it. It leaves the switcher;
 *  anyone still pointed at it lands on the first live club. */
export async function setClubArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("clubs.manage");

  const result = await prisma.$transaction(async (tx) => {
    // Two administrators cannot each archive the other's last live club.
    await tx.$queryRaw`SELECT id FROM "Club" ORDER BY id FOR UPDATE`;
    const existing = await tx.club.findUnique({
      where: { id },
      select: { id: true, name: true, archivedAt: true },
    });
    if (!existing) return fail("That site no longer exists.");
    if (Boolean(existing.archivedAt) === archived) return ok();

    if (archived) {
      const others = await tx.club.count({ where: { archivedAt: null, id: { not: id } } });
      if (others === 0) return fail("Keep at least one active site. Add another before archiving this one.");
    }

    await tx.club.update({
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
    }, tx);
    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/clubs");
  revalidatePath("/", "layout");
  return ok();
}
