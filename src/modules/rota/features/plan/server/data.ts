import "server-only";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canChange } from "@/modules/rota/shared/access";
import { addDaysIso, mondayOf } from "@/modules/rota/shared/constants";
import { ANY_DEPARTMENT, buildDay } from "@/modules/rota/shared/day";
import { type RotaSite, loadDays, pickSite } from "@/modules/rota/shared/data";

/** A site's departments: its own and the organisation-wide ones. */
function siteDepartments(orgId: string | undefined, siteId: string) {
  return prisma.department.findMany({
    where: { orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: siteId }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true },
  });
}

/** The departments this person belongs to: where Plan lets them change the days ahead. */
async function memberOf(userId: string) {
  return new Set((await prisma.userDepartment.findMany({ where: { userId }, orderBy: { isPrimary: "desc" }, select: { departmentId: true } })).map((m) => m.departmentId));
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
  const inDept = (d: ReturnType<typeof buildDay>) => ({ ...d, groups: d.groups.filter(ours) });
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(monday, i);
    const d = inDept(buildDay(dayInput(iso)));
    return { iso, gapCount: d.groups.reduce((n, g) => n + g.gapCount, 0), planned: d.groups.some((g) => g.departmentId !== ANY_DEPARTMENT) };
  });
  const full = buildDay(dayInput(date));
  const groups = full.groups.filter(ours);
  // The areas with something of this department's in them, each showing only that.
  const zones = full.zones.map((z) => {
    const mine = z.groups.filter(ours);
    return { ...z, groups: mine, gapCount: mine.reduce((n, g) => n + g.gapCount, 0) };
  }).filter((z) => z.groups.length);
  // Everyone on this department's activities, and everyone put on a shift on its plan.
  const people = full.people.filter((p) => p.planned.some((x) => x.departmentId === department?.id) || groups.some((g) => g.lanes.some((l) => l.some((b) => b.userId === p.userId))))
    .map((p) => ({ ...p, options: p.options.filter((o) => o.departmentId === department?.id) }));
  const share = department ? await prisma.rotaWeekShare.findUnique({
    where: { siteId_departmentId_monday: { siteId: site.id, departmentId: department.id, monday: parseDateOnly(monday) } }, select: { sharedAt: true, sharedByName: true },
  }) : null;
  const at = { plan: site.plan, run: site.run };
  return {
    who, sites, site, monday, now, date, departments, department, week, share,
    day: { ...full, zones, groups, people, gapCount: groups.reduce((n, g) => n + g.gapCount, 0) },
    canChange: !!department && canChange(at, date, now, department.id, mine),
    canShare: !!department && (site.run || (site.plan && mine.has(department.id))),
    types: types.filter((t) => !t.archived && t.departmentId === department?.id && !t.fromClasses),
    places,
  } as const;
}


export type PlanWeek = Extract<Awaited<ReturnType<typeof planWeek>>, { site: RotaSite }>;
