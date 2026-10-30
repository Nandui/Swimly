import "server-only";
import { notFound } from "next/navigation";
import { staffByIds } from "@/lib/directory";
import { today } from "@/lib/format";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { offsBetween, peopleFor } from "@/modules/plan/shared/data";
import { shiftIso } from "@/modules/plan/shared/model";
import { planSites, plannableDepartments, viewableSite } from "@/modules/plan/shared/scope";

/** Who is off at a site, from a week ago to three months ahead, and the people the person may mark
 *  off (those in the departments they plan; everyone for Manage). Plan's own record: no reasons
 *  beyond holiday, sick or off, and no return to work (that stays in the old Rota). */
export async function planOffs(params: { site?: string }) {
  const who = await requirePlanActor();
  const sites = await planSites(who);
  const siteId = sites.find((s) => s.id === params.site)?.id ?? sites[0]?.id;
  if (!siteId) return { who, sites, site: null } as const;
  const site = await viewableSite(siteId);
  if (!site) notFound();
  const from = shiftIso(today(), -7);
  const people = await peopleFor(site.orgId, site.id, []);
  const departments = await plannableDepartments(who, site.id, site.orgId);
  const mine = new Set(departments.mine.map((d) => d.id));
  const offs = await offsBetween(site.orgId, from, shiftIso(today(), 92), people.map((p) => p.id));
  const names = await staffByIds(offs.map((o) => o.userId));
  return {
    who, sites, site, today: today(),
    people: people.filter((p) => p.departmentIds.some((d) => mine.has(d))),
    offs: offs.map((o) => ({ ...o, name: names.get(o.userId)?.name ?? "Someone who has left",
      canChange: people.find((p) => p.id === o.userId)?.departmentIds.some((d) => mine.has(d)) ?? false })),
  } as const;
}
export type PlanOffsData = Extract<Awaited<ReturnType<typeof planOffs>>, { offs: unknown }>;
