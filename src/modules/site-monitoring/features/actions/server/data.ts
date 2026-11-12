import "server-only";
import { withSites } from "@/lib/directory";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireMonitoringActor } from "@/modules/site-monitoring/shared/access";

/** The actions at the sites this person sees: every open one, oldest first, and the latest 30
 *  closed with what was done. `act` says, per site, whether they may close them there. */
export async function monitoringActions() {
  const who = await requireMonitoringActor();
  const sites = await sitesFor("site-monitoring.read");
  const where = { orgId: who.orgId ?? undefined, ...(sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } }) };
  const [open, closed] = await Promise.all([
    prisma.monitoringAction.findMany({ where: { ...where, status: "open" }, orderBy: { recordedAt: "asc" } }),
    prisma.monitoringAction.findMany({ where: { ...where, status: "closed" }, orderBy: { closedAt: "desc" }, take: 30 }),
  ]);
  const siteIds = [...new Set([...open, ...closed].map((a) => a.siteId))];
  const acts = new Map(await Promise.all(siteIds.map(async (id) => [id, who.act && await mayFor("site-monitoring.act", { siteId: id, orgId: who.orgId })] as const)));
  const shape = async (rows: typeof open) => (await withSites(rows, "siteId", "site")).map((a) => ({ ...a, act: acts.get(a.siteId) ?? false }));
  return { open: await shape(open), closed: await shape(closed) };
}

/** How many are open at the sites this person sees, for the home page. */
export async function openMonitoringCount(orgId: string | null) {
  const sites = await sitesFor("site-monitoring.read");
  return prisma.monitoringAction.count({ where: { orgId: orgId ?? undefined, status: "open", ...(sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } }) } });
}
