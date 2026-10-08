"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_ICON_KEYS } from "@/lib/setup/meta";
import { renameAreaEverywhere } from "@/modules/server";

/** Writes to the shared setup (docs/admin-setup.md): the activity list and
 *  each site's areas. Each list needs its own permission (Admin: Manage, or
 *  Admin: Setup with that list's tick). Every change is audited under Admin. */

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/rota", "layout");
}

/* ---------- The activity list ---------- */

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the activity, for example Lifeguarding.").max(40, "Keep the name under 40 characters."),
  departmentId: z.string().min(1, "Choose the department that plans it."),
  icon: z.enum(ACTIVITY_ICON_KEYS as [string, ...string[]]),
  requiredTypeId: z.string().trim().max(64).default("").transform((v) => v || null),
  fromClasses: z.boolean().default(false),
});
export type ActivityTypeInput = z.input<typeof typeSchema>;

/** Add an activity to the organisation's list, or change one. One activity takes the swim classes. */
export async function saveActivityType(id: string | null, input: ActivityTypeInput): Promise<ActionResult> {
  const session = await requirePermission("setup.activities");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  if (!(await prisma.department.findFirst({ where: { id: data.departmentId, orgId, archivedAt: null }, select: { id: true } }))) return fail("Choose one of your departments.");
  if (data.requiredTypeId && !(await prisma.qualificationType.findFirst({ where: { id: data.requiredTypeId, orgId }, select: { id: true } }))) return fail("That qualification is no longer offered.");
  const clash = await prisma.activityType.findFirst({ where: { orgId, name: { equals: data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail("There is already an activity with that name.");
  if (data.fromClasses && (await prisma.activityType.findFirst({ where: { orgId, fromClasses: true, archivedAt: null, ...(id ? { id: { not: id } } : {}) }, select: { name: true } }))) {
    return fail("Another activity already takes the swim classes.");
  }
  if (id && !(await prisma.activityType.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That activity is no longer on the list.");
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.activityType.update({ where: { id }, data }) : await tx.activityType.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "ActivityType", entityId: row.id, clubId: null, summary: `${id ? "Changed" : "Added"} the activity ${data.name}` }, tx);
  });
  refresh("/activity-list");
  return ok();
}

/** Archive or restore an activity. Days already planned with it keep it. */
export async function archiveActivityType(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("setup.activities");
  const type = await prisma.activityType.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!type) return fail("That activity is no longer on the list.");
  await prisma.$transaction(async (tx) => {
    await tx.activityType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "ActivityType", entityId: id, clubId: null, summary: `${archived ? "Archived" : "Restored"} the activity ${type.name}` }, tx);
  });
  refresh("/activity-list");
  return ok();
}

/* ---------- Each site's areas ---------- */

const areaName = z.string().trim().min(1, "Name the area, for example 25m pool.").max(60, "Keep the name under 60 characters.");

/** Add an area to a site, or rename one. A rename reaches every module's records that use it. */
export async function saveArea(siteId: string, id: string | null, input: { name: string }): Promise<ActionResult> {
  const session = await requirePermission("setup.areas");
  const parsed = areaName.safeParse(input.name);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const name = parsed.data.replace(/\s+/g, " ");
  if (name.includes(",")) return fail("Leave commas out of an area's name: a swim class adds its detail after one, as in Learner pool, lane 3.");
  const site = await prisma.club.findFirst({ where: { id: siteId, orgId: session.user.orgId ?? undefined, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return fail("That site is not open.");
  const clash = await prisma.siteArea.findFirst({ where: { siteId, name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail(`${site.name} already has an area called ${name}.`);
  const existing = id ? await prisma.siteArea.findFirst({ where: { id, siteId }, select: { name: true } }) : null;
  if (id && !existing) return fail("That area no longer exists.");
  if (existing?.name === name) return ok();
  const last = id ? null : await prisma.siteArea.findFirst({ where: { siteId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  let moved = 0;
  await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.siteArea.update({ where: { id }, data: { name } });
      moved = await renameAreaEverywhere({ siteId, from: existing!.name, to: name }, tx);
    } else {
      await tx.siteArea.create({ data: { orgId: site.orgId!, siteId, name, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    }
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "SiteArea", entityId: id, clubId: siteId,
      summary: id ? `Renamed ${site.name}'s area ${existing!.name} to ${name}${moved ? `, and ${moved} ${moved === 1 ? "record" : "records"} that use it` : ""}` : `Added the area ${name} at ${site.name}` }, tx);
  });
  refresh("/areas");
  return ok();
}

/** Archive or restore an area. Archived ones are no longer offered; records that use them keep the name. */
export async function setAreaArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("setup.areas");
  const area = await prisma.siteArea.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true, siteId: true, site: { select: { name: true } } } });
  if (!area) return fail("That area no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.siteArea.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "SiteArea", entityId: id, clubId: area.siteId,
      summary: `${archived ? "Archived" : "Restored"} ${area.site.name}'s area ${area.name}` }, tx);
  });
  refresh("/areas");
  return ok();
}

/** Move an area up or down its site's list: the order every module offers them in. */
export async function moveArea(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const session = await requirePermission("setup.areas");
  const area = await prisma.siteArea.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { siteId: true } });
  if (!area) return fail("That area no longer exists.");
  const list = await prisma.siteArea.findMany({ where: { siteId: area.siteId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
  const at = list.findIndex((a) => a.id === id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= list.length) return ok();
  [list[at], list[to]] = [list[to], list[at]];
  await prisma.$transaction(list.map((a, i) => prisma.siteArea.update({ where: { id: a.id }, data: { sortOrder: i } })));
  refresh("/areas");
  return ok();
}

/* ---------- Positions ---------- */

const positionSchema = z.object({
  name: z.string().trim().min(2, "Name the position, for example Lifeguard.").max(60, "Keep the name under 60 characters."),
  requires: z.array(z.string().min(1)).max(30).default([]),
});
export type PositionInput = z.input<typeof positionSchema>;

/** Add a position, or rename one and change what it needs. Holders' job title follows a rename. */
export async function savePosition(id: string | null, input: PositionInput): Promise<ActionResult> {
  const session = await requirePermission("setup.positions");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, requires } = parsed.data;
  const clash = await prisma.position.findFirst({ where: { orgId, name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail("There is already a position with that name.");
  const types = await prisma.qualificationType.findMany({ where: { orgId, id: { in: requires } }, select: { id: true, name: true } });
  if (types.length !== new Set(requires).size) return fail("Some of those qualifications are no longer offered.");
  if (id && !(await prisma.position.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That position no longer exists.");
  const last = id ? null : await prisma.position.findFirst({ where: { orgId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await prisma.$transaction(async (tx) => {
    const row = id
      ? await tx.position.update({ where: { id }, data: { name } })
      : await tx.position.create({ data: { orgId, name, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    await tx.positionQualification.deleteMany({ where: { positionId: row.id } });
    if (types.length) await tx.positionQualification.createMany({ data: types.map((t) => ({ positionId: row.id, typeId: t.id })) });
    // Every screen that shows a job title keeps showing the position's name.
    if (id) await tx.user.updateMany({ where: { positionId: row.id }, data: { jobTitle: name } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "Position", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the position ${name}${types.length ? `, needing ${types.map((t) => t.name).join(", ")}` : ", needing no qualifications"}` }, tx);
  });
  revalidatePath("/positions");
  revalidatePath("/staff", "layout");
  return ok();
}

/** Archive or restore a position. Its holders keep it until someone changes theirs. */
export async function setPositionArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("setup.positions");
  const position = await prisma.position.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!position) return fail("That position no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.position.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "Position", entityId: id, clubId: null, summary: `${archived ? "Archived" : "Restored"} the position ${position.name}` }, tx);
  });
  revalidatePath("/positions");
  return ok();
}
