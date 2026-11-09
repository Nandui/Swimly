"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { staffSiteIds, staffStatus } from "@/lib/directory";
import { formatTime } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import {
  COLLEGES, CONTRACT_KIND_META, CONTRACT_KINDS, SEASON_LABEL, SEASON_NAMES, settingsSchema, SLOT_ROLES, toMinutes, WEEKDAY_SHORT, COLLEGE_META,
} from "@/modules/staffing/shared/rules";
import { atSite, dateOf, refresh, settingsFor } from "@/modules/staffing/shared/server";

/** Set up writes: slots (Supervise at the site), staff (Supervise at a site they work at), exam
 *  seasons and settings (Manage; the organisation's). Slots are archived, never deleted. */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 10:15.");
const slotSchema = z.object({
  name: z.string().trim().min(2, "Give the slot a name.").max(60, "Keep the name under 60 characters."),
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Choose at least one day."),
  role: z.enum(SLOT_ROLES),
  start: time, end: time,
  needed: z.coerce.number().int().min(1, "At least one person.").max(30),
  hardToFill: z.boolean().default(false),
}).refine((v) => toMinutes(v.end) > toMinutes(v.start), { message: "The slot ends after it starts." });
export type SlotInput = z.input<typeof slotSchema>;

/** Add a slot on one or more weekdays, or change one (its own weekday only). */
export async function saveSlot(siteId: string, id: string | null, input: SlotInput): Promise<ActionResult> {
  const where = await atSite(siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const data = { name: d.name, role: d.role, startMin: toMinutes(d.start), endMin: toMinutes(d.end), needed: d.needed, hardToFill: d.hardToFill };
  if (id) {
    const before = await prisma.staffingSlot.findFirst({ where: { id, siteId }, select: { id: true } });
    if (!before) return fail("That slot no longer exists.");
  }
  await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.staffingSlot.update({ where: { id }, data: { ...data, weekday: d.weekdays[0] } });
      await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "update", entity: "StaffingSlot", entityId: id, clubId: siteId,
        summary: `Changed the slot ${d.name}, ${WEEKDAY_SHORT[d.weekdays[0] - 1]} ${d.start} to ${d.end}, ${d.needed} needed, at ${where.site.name}` }, tx);
      return;
    }
    for (const weekday of [...new Set(d.weekdays)].sort()) {
      const row = await tx.staffingSlot.create({ data: { ...data, weekday, orgId: where.actor.orgId, siteId } });
      await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "create", entity: "StaffingSlot", entityId: row.id, clubId: siteId,
        summary: `Added the slot ${d.name}, ${WEEKDAY_SHORT[weekday - 1]} ${formatTime(data.startMin)} to ${formatTime(data.endMin)}, ${d.needed} needed, at ${where.site.name}` }, tx);
    }
  });
  refresh("/staffing/slots");
  return ok();
}

export async function archiveSlot(id: string, archived: boolean): Promise<ActionResult> {
  const slot = await prisma.staffingSlot.findUnique({ where: { id }, select: { siteId: true, name: true, weekday: true } });
  if (!slot) return fail("That slot no longer exists.");
  const where = await atSite(slot.siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  await prisma.$transaction(async (tx) => {
    await tx.staffingSlot.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: archived ? "archive" : "restore", entity: "StaffingSlot", entityId: id, clubId: slot.siteId,
      summary: `${archived ? "Archived" : "Restored"} the slot ${slot.name}, ${WEEKDAY_SHORT[slot.weekday - 1]}, at ${where.site.name}` }, tx);
  });
  refresh("/staffing/slots");
  return ok();
}

const staffSchema = z.object({ college: z.enum(COLLEGES), contract: z.enum(CONTRACT_KINDS), wantsMore: z.boolean().default(false) });

/** Put someone on the Staffing rota, change their college or contract, or stop (keep = false). */
export async function saveStaff(siteId: string, userId: string, keep: boolean, input: z.input<typeof staffSchema>): Promise<ActionResult> {
  const where = await atSite(siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const person = await staffStatus(userId);
  if (!person || person.orgId !== where.actor.orgId) return fail("That person is not in your organisation.");
  const worksHere = await staffSiteIds(userId);
  if (worksHere.length && !worksHere.includes(siteId)) return fail(`${person.name} does not work at ${where.site.name}.`);
  const before = await prisma.staffingTeacher.findUnique({ where: { userId } });
  await prisma.$transaction(async (tx) => {
    if (!keep) {
      if (!before) return;
      await tx.staffingTeacher.delete({ where: { userId } });
      await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "delete", entity: "StaffingTeacher", entityId: before.id, clubId: null, summary: `${person.name} is no longer on the Staffing rota` }, tx);
      return;
    }
    const row = await tx.staffingTeacher.upsert({ where: { userId }, create: { ...parsed.data, userId, orgId: where.actor.orgId }, update: parsed.data });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: before ? "update" : "create", entity: "StaffingTeacher", entityId: row.id, clubId: null,
      summary: `${before ? `Changed ${person.name} on` : `Added ${person.name} to`} the Staffing rota: ${COLLEGE_META[parsed.data.college].label}, ${CONTRACT_KIND_META[parsed.data.contract].label.toLowerCase()} contract${parsed.data.wantsMore ? ", wants extra hours" : ""}` }, tx);
  });
  refresh("/staffing/staff");
  return ok();
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const seasonSchema = z.object({
  college: z.enum(["ucc", "mtu"]), name: z.enum(SEASON_NAMES), startsOn: date, endsOn: date,
  firstYearStartsOn: z.union([z.literal(""), date]).default(""), confirmed: z.boolean().default(false),
}).refine((v) => v.endsOn >= v.startsOn, { message: "The season ends on or after it starts." });
export type SeasonInput = z.input<typeof seasonSchema>;

/** Add or change an exam season (operations manager, each August: BR-7.1). */
export async function saveSeason(id: string | null, input: SeasonInput): Promise<ActionResult> {
  const session = await requirePermission("staffing.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (id && !(await prisma.staffingExamSeason.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That season no longer exists.");
  const data = { college: d.college, name: d.name, startsOn: dateOf(d.startsOn), endsOn: dateOf(d.endsOn), firstYearStartsOn: d.firstYearStartsOn ? dateOf(d.firstYearStartsOn) : null, confirmed: d.confirmed };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.staffingExamSeason.update({ where: { id }, data }) : await tx.staffingExamSeason.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "StaffingExamSeason", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the ${COLLEGE_META[d.college].label} ${SEASON_LABEL[d.name].toLowerCase()} exam season, ${d.startsOn} to ${d.endsOn}${d.confirmed ? "" : " (not confirmed)"}` }, tx);
  });
  refresh("/staffing/seasons");
  return ok();
}

export async function deleteSeason(id: string): Promise<ActionResult> {
  const session = await requirePermission("staffing.manage");
  const season = await prisma.staffingExamSeason.findFirst({ where: { id, orgId: session.user.orgId ?? undefined } });
  if (!season) return fail("That season no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.staffingExamSeason.delete({ where: { id } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "delete", entity: "StaffingExamSeason", entityId: id, clubId: null,
      summary: `Removed the ${COLLEGE_META[season.college as "ucc"]?.label ?? season.college} ${season.name} exam season` }, tx);
  });
  refresh("/staffing/seasons");
  return ok();
}

/** Save the settings. Legal minimums (rest, notice) cannot be lowered past the law. */
export async function saveSettings(input: Record<string, unknown>): Promise<ActionResult> {
  const session = await requirePermission("staffing.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(`${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}`);
  if (parsed.data.restHours < 11) return fail("Rest between shifts can't be set below the legal 11 hours.");
  if (parsed.data.minNoticeHours < 24) return fail("Minimum notice can't be set below the legal 24 hours.");
  if (!(await mayFor("staffing.manage", { orgId }))) return fail("This needs Staffing Manage.");
  const before = await settingsFor(orgId);
  const changed = Object.entries(parsed.data).filter(([k, v]) => before[k as keyof typeof before] !== v);
  await prisma.$transaction(async (tx) => {
    const row = await tx.staffingSettings.upsert({ where: { orgId }, create: { orgId, values: parsed.data }, update: { values: parsed.data } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "update", entity: "StaffingSettings", entityId: row.id, clubId: null,
      summary: changed.length ? `Changed Staffing's settings: ${changed.map(([k, v]) => `${k} to ${v ?? "none"}`).join(", ")}` : "Saved Staffing's settings (no change)" }, tx);
  });
  refresh("/staffing/settings");
  return ok();
}
