import "server-only";
import { notFound } from "next/navigation";
import { departmentsForSite } from "@/lib/directory";
import { today } from "@/lib/format";
import { qualificationTypesOf } from "@/lib/qualifications";
import { prisma } from "@/lib/prisma";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { areasOf, dutiesOf } from "@/modules/plan/shared/data";
import { mayManage, planSites, viewableSite } from "@/modules/plan/shared/scope";

/** Setup: the organisation's duties, and a site's areas and sessions (current and to come). Anyone
 *  with the plan reads it; only Manage at the site changes it. */
export async function planSetup(params: { site?: string }) {
  const who = await requirePlanActor();
  const sites = await planSites(who);
  const siteId = sites.find((s) => s.id === params.site)?.id ?? sites[0]?.id;
  if (!siteId) return { who, sites, site: null } as const;
  const site = await viewableSite(siteId);
  if (!site) notFound();
  const from = today();
  const [duties, areas, departments, qualifications, manage, sessions] = await Promise.all([
    dutiesOf(site.orgId), areasOf(site.orgId, site.id), departmentsForSite(site.orgId, site.id), qualificationTypesOf(site.orgId),
    mayManage(site.id, site.orgId),
    prisma.planSession.findMany({
      where: { orgId: site.orgId, siteId: site.id, cancelledAt: null, lastDay: { gte: from } },
      orderBy: [{ firstDay: "asc" }, { startMinutes: "asc" }], include: { needs: true },
    }),
  ]);
  return {
    who, sites, site, today: from, manage, duties, areas, departments,
    qualifications: qualifications.filter((q) => !q.archivedAt).map((q) => ({ id: q.id, name: q.name })),
    sessions: sessions.map((s) => ({
      id: s.id, title: s.title, areaId: s.areaId, lanes: s.lanes, start: s.startMinutes, end: s.endMinutes, weekdays: s.weekdays,
      firstDay: s.firstDay, lastDay: s.lastDay, skipDays: s.skipDays, note: s.note, needs: s.needs.map((n) => ({ dutyId: n.dutyId, count: n.count })),
    })),
  } as const;
}
export type PlanSetupData = Extract<Awaited<ReturnType<typeof planSetup>>, { manage: boolean }>;
