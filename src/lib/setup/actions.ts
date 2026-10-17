"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_ICON_KEYS } from "@/lib/setup/meta";
import { WEEKDAYS, hoursWords, type WeekHour } from "@/lib/setup/area-staffing";
import { Prisma } from "@/generated/prisma/client";
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
});
export type ActivityTypeInput = z.input<typeof typeSchema>;

/** Add an activity to the organisation's list, or change one. No activity takes the swim classes
 *  any more (owner decision, 16 October 2026: they fill the rota Plan by themselves), so saving
 *  one that used to makes it an ordinary activity. */
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
  if (id && !(await prisma.activityType.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That activity is no longer on the list.");
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.activityType.update({ where: { id }, data: { ...data, fromClasses: false } }) : await tx.activityType.create({ data: { ...data, orgId } });
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

const areaLanes = z.coerce.number().int("Give a whole number of lanes.").min(0, "Give 0 lanes for an area without lanes.").max(20, "Up to 20 lanes.");

/** Add an area to a site, or rename one, and say how many lanes it has (0 for none). A rename
 *  reaches every module's records that use it. */
export async function saveArea(siteId: string, id: string | null, input: { name: string; lanes?: number | string }): Promise<ActionResult> {
  const session = await requirePermission("setup.areas");
  const parsed = areaName.safeParse(input.name);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const lanesParsed = areaLanes.safeParse(input.lanes === "" || input.lanes === undefined ? 0 : input.lanes);
  if (!lanesParsed.success) return fail(lanesParsed.error.issues[0].message);
  const lanes = lanesParsed.data;
  const name = parsed.data.replace(/\s+/g, " ");
  if (name.includes(",")) return fail("Leave commas out of an area's name: a swim class adds its detail after one, as in Learner pool, lane 3.");
  const site = await prisma.club.findFirst({ where: { id: siteId, orgId: session.user.orgId ?? undefined, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return fail("That site is not open.");
  const clash = await prisma.siteArea.findFirst({ where: { siteId, name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail(`${site.name} already has an area called ${name}.`);
  const existing = id ? await prisma.siteArea.findFirst({ where: { id, siteId }, select: { name: true, lanes: true } }) : null;
  if (id && !existing) return fail("That area no longer exists.");
  if (existing?.name === name && existing.lanes === lanes) return ok();
  const renamed = !!existing && existing.name !== name;
  const last = id ? null : await prisma.siteArea.findFirst({ where: { siteId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  let moved = 0;
  await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.siteArea.update({ where: { id }, data: { name, lanes } });
      if (renamed) moved = await renameAreaEverywhere({ siteId, from: existing!.name, to: name }, tx);
    } else {
      await tx.siteArea.create({ data: { orgId: site.orgId!, siteId, name, lanes, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    }
    const laneWords = lanes ? `${lanes} ${lanes === 1 ? "lane" : "lanes"}` : "no lanes";
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "SiteArea", entityId: id, clubId: siteId,
      summary: !id ? `Added the area ${name} at ${site.name}, ${laneWords}`
        : [renamed ? `Renamed ${site.name}'s area ${existing!.name} to ${name}${moved ? `, and ${moved} ${moved === 1 ? "record" : "records"} that use it` : ""}` : null,
          existing!.lanes !== lanes ? `${renamed ? "gave it" : `Gave ${site.name}'s area ${name}`} ${laneWords}` : null].filter(Boolean).join("; ") }, tx);
  });
  refresh("/areas");
  return ok();
}

const clockTime = z.string().trim().max(5).refine((v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use times like 07:00.");
const staffingSchema = z.object({
  lines: z.array(z.object({
    count: z.coerce.number().int("Give a whole number of staff.").min(1, "Give at least 1 staff, or remove the line.").max(30, "Up to 30 staff."),
    typeId: z.string().trim().max(64).default("").transform((v) => v || null),
  })).max(8, "Up to 8 lines."),
  openFrom: clockTime.default(""),
  openUntil: clockTime.default(""),
  /** A weekday's own hours, Monday 0; both empty is closed that day. Weekdays left out keep every day's. */
  days: z.array(z.object({ day: z.number().int().min(0).max(6), from: clockTime.default(""), until: clockTime.default("") })).max(7).default([]),
  /** Staff in another area covering this one while both are open. */
  together: z.array(z.object({
    withAreaId: z.string().trim().min(1, "Choose the area that covers it.").max(64),
    count: z.coerce.number().int("Give a whole number of staff.").min(1, "Give at least 1 staff in all.").max(30, "Up to 30 staff."),
    typeId: z.string().trim().max(64).default("").transform((v) => v || null),
  })).max(4, "Up to 4 areas.").default([]),
});
export type AreaStaffingInput = z.input<typeof staffingSchema>;
const minutesOf = (v: string) => (v ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5)) : null);

/** Set the staff an area needs and the hours it is open (owner requests, 16 October 2026: "the 25
 *  meter pool has a time to be open, and during that time it will need a specific amount of staff
 *  with specific qualifications"): every day's hours, and a weekday's own hours or closed. Each line
 *  is then a need on the rota Plan while it is open. No lines takes the need away. */
export async function saveAreaStaffing(id: string, input: AreaStaffingInput): Promise<ActionResult> {
  const session = await requirePermission("setup.areas");
  const orgId = session.user.orgId;
  const parsed = staffingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { lines } = parsed.data;
  const openFrom = minutesOf(parsed.data.openFrom), openUntil = minutesOf(parsed.data.openUntil);
  if ((openFrom === null) !== (openUntil === null)) return fail("Give both opening times, or leave both empty.");
  if (openFrom !== null && openUntil !== null && openUntil <= openFrom) return fail("It has to close after it opens, on the same day.");
  const days: WeekHour[] = [];
  for (const d of parsed.data.days) {
    const from = minutesOf(d.from), until = minutesOf(d.until);
    if ((from === null) !== (until === null)) return fail(`Give both of ${WEEKDAYS[d.day]}'s times, or choose closed.`);
    if (from !== null && until !== null && until <= from) return fail(`On ${WEEKDAYS[d.day]} it has to close after it opens.`);
    if (!days.some((x) => x.day === d.day)) days.push({ day: d.day, from, until });
  }
  days.sort((a, b) => a.day - b.day);
  if (lines.length && openFrom === null && !days.some((d) => d.from !== null)) return fail("Give the hours it is open, when it needs these staff.");
  const area = await prisma.siteArea.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { name: true, siteId: true, site: { select: { name: true } } } });
  if (!area) return fail("That area no longer exists.");
  const { together } = parsed.data;
  const others = together.length ? await prisma.siteArea.findMany({ where: { siteId: area.siteId, archivedAt: null, id: { in: together.map((t) => t.withAreaId), not: id } }, select: { id: true, name: true } }) : [];
  if (together.some((t) => !others.some((o) => o.id === t.withAreaId))) return fail("Choose another open area at this site to cover it.");
  if (together.some((t) => !lines.some((l) => l.typeId === t.typeId))) return fail("It can only be covered for a type of staff it needs. Add that type of staff above first.");
  if (new Set(together.map((t) => `${t.withAreaId}|${t.typeId ?? ""}`)).size !== together.length) return fail("Each area and type of staff once.");
  const typeIds = [...new Set(lines.flatMap((l) => (l.typeId ? [l.typeId] : [])))];
  const types = typeIds.length ? await prisma.qualificationType.findMany({ where: { id: { in: typeIds }, orgId: orgId ?? undefined }, select: { id: true, name: true } }) : [];
  if (types.length !== typeIds.length) return fail("That qualification is no longer offered.");
  if (new Set(lines.map((l) => l.typeId ?? "")).size !== lines.length) return fail("Each type of staff once: add to its number instead.");
  const name = new Map(types.map((t) => [t.id, t.name]));
  const words = lines.length ? lines.map((l) => `${l.count} ${l.typeId ? name.get(l.typeId) : "anyone"}`).join(", ") : "no minimum";
  const hours = lines.length ? `, ${hoursWords({ openFrom, openUntil, weekHours: days })}` : "";
  const covered = together.map((t) => `, covered from ${others.find((o) => o.id === t.withAreaId)!.name} while both are open (${t.count} ${t.typeId ? name.get(t.typeId) : "anyone"} in all)`).join("");
  await prisma.$transaction(async (tx) => {
    await tx.siteAreaStaffing.deleteMany({ where: { areaId: id } });
    if (lines.length) await tx.siteAreaStaffing.createMany({ data: lines.map((l, i) => ({ areaId: id, count: l.count, qualificationTypeId: l.typeId, sortOrder: i })) });
    await tx.siteArea.update({ where: { id }, data: { openFrom, openUntil, weekHours: days.length ? days : Prisma.DbNull, together: together.length ? together : Prisma.DbNull } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "update", entity: "SiteArea", entityId: id, clubId: area.siteId,
      summary: `Set ${area.site.name}'s area ${area.name} to ${words}${hours}${covered}` }, tx);
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
