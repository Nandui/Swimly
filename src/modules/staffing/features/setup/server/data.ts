import "server-only";
import { activeStaffAgesAtSite, contractMinutesByIds } from "@/lib/directory";
import { toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationTypesOf } from "@/lib/qualifications";
import { examDeadline, type ContractKind } from "@/modules/staffing/shared/rules";
import { pickSite, settingsFor, staffingSites } from "@/modules/staffing/shared/server";

/** Set up: a site's weekly slots, who is a teacher, the exam seasons and the settings. */

export async function slotsPage(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  const slots = await prisma.staffingSlot.findMany({ where: { siteId: site.id }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }, { name: "asc" }] });
  return { who, sites, site, slots: slots.map((s) => ({ id: s.id, weekday: s.weekday, role: s.role, name: s.name, startMin: s.startMin, endMin: s.endMin, needed: s.needed, hardToFill: s.hardToFill, archived: !!s.archivedAt })) };
}

export async function teachersPage(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  const staff = await activeStaffAgesAtSite(who.orgId, site.id);
  const ids = staff.map((s) => s.id);
  const [rows, contracts] = await Promise.all([prisma.staffingTeacher.findMany({ where: { userId: { in: ids } } }), contractMinutesByIds(ids)]);
  const kept = new Map(rows.map((r) => [r.userId, r]));
  return {
    who, sites, site,
    staff: staff.map((s) => {
      const row = kept.get(s.id);
      return { id: s.id, name: s.name, teacher: !!row, college: row?.college ?? "none", contract: (row?.contract ?? "swim_teacher") as ContractKind, wantsMore: row?.wantsMore ?? false, contractMinutes: contracts.get(s.id) ?? null };
    }),
  };
}

export async function seasonsPage() {
  const { who, sites } = await staffingSites();
  const settings = await settingsFor(who.orgId);
  const rows = await prisma.staffingExamSeason.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: { startsOn: "desc" } });
  return {
    who, sites,
    seasons: rows.map((x) => {
      const startsOn = toDateOnlyString(x.startsOn);
      return { id: x.id, college: x.college, name: x.name, startsOn, endsOn: toDateOnlyString(x.endsOn), firstYearStartsOn: x.firstYearStartsOn ? toDateOnlyString(x.firstYearStartsOn) : null, confirmed: x.confirmed, deadline: examDeadline(startsOn, settings) };
    }),
  };
}

export async function settingsPage() {
  const { who, sites } = await staffingSites();
  const [settings, types] = await Promise.all([settingsFor(who.orgId), qualificationTypesOf(who.orgId)]);
  return { who, sites, settings, types: types.map((t) => ({ id: t.id, name: t.name })) };
}
