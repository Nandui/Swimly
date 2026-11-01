import "server-only";
import { notFound } from "next/navigation";
import { today } from "@/lib/format";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { dutiesOf, offsBetween, peopleFor, shiftsAt } from "@/modules/plan/shared/data";
import { mondayOf, shiftIso } from "@/modules/plan/shared/model";
import { planSites, plannableDepartments, viewableSite } from "@/modules/plan/shared/scope";

/** The Week: one department's people, Monday to Sunday, with each shift and who is off. The
 *  department's own people come first, then anyone borrowed onto its plan. */
export async function planWeek(params: { site?: string; week?: string; dept?: string }) {
  const who = await requirePlanActor();
  const sites = await planSites(who);
  const siteId = sites.find((s) => s.id === params.site)?.id ?? sites[0]?.id;
  if (!siteId) return { who, sites, site: null } as const;
  const site = await viewableSite(siteId);
  if (!site) notFound();
  const monday = mondayOf(params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : today());
  const sunday = shiftIso(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftIso(monday, i));
  const departments = await plannableDepartments(who, site.id, site.orgId);
  const department = departments.all.find((d) => d.id === params.dept) ?? departments.mine[0] ?? departments.all[0] ?? null;
  const all = await shiftsAt(site.orgId, site.id, monday, sunday);
  const shifts = department ? all.filter((s) => s.departmentId === department.id) : [];
  const [people, duties] = await Promise.all([peopleFor(site.orgId, site.id, shifts.map((s) => s.userId)), dutiesOf(site.orgId)]);
  const own = department ? people.filter((p) => p.departmentIds.includes(department.id)) : [];
  const borrowed = people.filter((p) => !own.includes(p) && shifts.some((s) => s.userId === p.id));
  const rows = [...own, ...borrowed];
  const offs = await offsBetween(site.orgId, monday, sunday, rows.map((p) => p.id));
  // Shifts the same people have on other departments' plans here, so a double booking shows.
  const otherPlans = all.filter((s) => s.departmentId !== department?.id && rows.some((p) => p.id === s.userId));
  return {
    who, sites, site, monday, days, today: today(), departments, department,
    canPlan: Boolean(department && departments.mine.some((d) => d.id === department.id)),
    rows: rows.map((p) => ({ ...p, borrowed: borrowed.includes(p) })),
    people, shifts, otherPlans, offs, duties,
  } as const;
}
export type PlanWeekData = Extract<Awaited<ReturnType<typeof planWeek>>, { days: unknown }>;
