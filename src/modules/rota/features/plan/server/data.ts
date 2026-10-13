import "server-only";
import { contractMinutesByIds, departmentIdsOf, departmentsForSite } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canChange } from "@/modules/rota/shared/access";
import { addDaysIso, mondayOf } from "@/modules/rota/shared/constants";
import { ANY_DEPARTMENT, buildDay, type Day } from "@/modules/rota/shared/day";
import { type RotaSite, loadDays, pickSite } from "@/modules/rota/shared/data";

/** A site's departments: its own and the organisation-wide ones. */
function siteDepartments(orgId: string | undefined, siteId: string) {
  return departmentsForSite(orgId ?? null, siteId);
}

/** The departments this person belongs to: where Plan lets them change the days ahead. */
async function memberOf(userId: string) {
  return new Set(await departmentIdsOf(userId));
}

/** The supervisor's Plan: one department's week at one site, a day of it laid out. It opens on
 *  the viewer's own department and, in the week shown, on today or the week's first day. */
export async function planWeek(input: { site?: string; week?: string; dept?: string; day?: string }) {
  const { who, sites, site } = await pickSite(input.site);
  const now = today();
  const monday = mondayOf(input.day && isDateOnly(input.day) ? input.day : input.week && isDateOnly(input.week) ? input.week : now);
  const sunday = addDaysIso(monday, 6);
  if (!site) return { who, sites, site: null, monday, now } as const;
  const orgId = who.orgId ?? undefined;
  const [departments, mine] = await Promise.all([siteDepartments(orgId, site.id), memberOf(who.id)]);
  const department = departments.find((d) => d.id === input.dept) ?? departments.find((d) => mine.has(d.id)) ?? departments[0] ?? null;
  const date = input.day && isDateOnly(input.day) && input.day >= monday && input.day <= sunday ? input.day : now >= monday && now <= sunday ? now : monday;
  const { types, dayInput, places } = await loadDays(site.id, orgId, monday, sunday);
  const ours = (g: { departmentId: string }) => g.departmentId === department?.id || g.departmentId === ANY_DEPARTMENT;
  const days = Array.from({ length: 7 }, (_, i) => buildDay(dayInput(addDaysIso(monday, i))));
  // Each person's paid time this week at this site, every department's.
  const weekMinutes = new Map<string, number>();
  for (const d of days) for (const p of d.people) weekMinutes.set(p.userId, (weekMinutes.get(p.userId) ?? 0) + p.shift.paidMinutes);
  const week = days.map((d) => {
    const groups = d.groups.filter(ours);
    const people = staffOf(d, department?.id ?? null);
    return { iso: d.date, gapCount: groups.reduce((n, g) => n + g.gapCount, 0), planned: groups.some((g) => g.departmentId !== ANY_DEPARTMENT) || people.length > 0,
      staff: people.length, paidMinutes: people.reduce((n, p) => n + p.shift.paidMinutes, 0) };
  });
  const full = days[Math.round((Date.parse(date) - Date.parse(monday)) / 86_400_000)];
  const groups = full.groups.filter(ours);
  // The areas with something of this department's in them, each showing only that.
  const zones = full.zones.map((z) => {
    const mine = z.groups.filter(ours);
    return { ...z, groups: mine, gapCount: mine.reduce((n, g) => n + g.gapCount, 0) };
  }).filter((z) => z.groups.length);
  // Everyone on this department's day; what they could take comes from every department, since a
  // supervisor may lend their people to another department's work (owner, 13 October 2026).
  const people = staffOf(full, department?.id ?? null);
  const contracts = await contractMinutesByIds(people.map((p) => p.userId));
  const hours = Object.fromEntries(people.map((p) => [p.userId, { week: weekMinutes.get(p.userId) ?? 0, contract: contracts.get(p.userId) ?? null }]));
  const share = department ? await prisma.rotaWeekShare.findUnique({
    where: { siteId_departmentId_monday: { siteId: site.id, departmentId: department.id, monday: parseDateOnly(monday) } }, select: { sharedAt: true, sharedByName: true },
  }) : null;
  const at = { plan: site.plan, run: site.run };
  return {
    who, sites, site, monday, now, date, departments, department, week, share,
    day: { ...full, zones, groups, people, gapCount: groups.reduce((n, g) => n + g.gapCount, 0) },
    /** Every department's activities that day, for lending and "show other departments". */
    allGroups: full.groups,
    hours,
    canChange: !!department && canChange(at, date, now, department.id, mine),
    canShare: !!department && (site.run || (site.plan && mine.has(department.id))),
    types: types.filter((t) => !t.archived && t.departmentId === department?.id && !t.fromClasses),
    areas: places,
  } as const;
}


/** The people on a department's day: on a shift on its plan, or on one of its activities. */
export function staffOf(day: Day, departmentId: string | null) {
  if (!departmentId) return [];
  const mine = day.groups.filter((g) => g.departmentId === departmentId);
  return day.people.filter((p) => p.planned.some((x) => x.departmentId === departmentId) || mine.some((g) => g.lanes.some((l) => l.some((b) => b.kind === "on" && b.userId === p.userId))));
}

export type PlanWeek = Extract<Awaited<ReturnType<typeof planWeek>>, { site: RotaSite }>;
