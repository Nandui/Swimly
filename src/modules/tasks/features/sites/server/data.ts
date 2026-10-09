import "server-only";
import { prisma } from "@/lib/prisma";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { siteSettings, templateSites } from "@/modules/tasks/shared/data";

/** Every site of the organisation with its Tasks settings and how many templates apply there
 *  (the prototype's Sites page). Reading needs Tasks at any site; changing needs Manage. */
export async function taskSites() {
  const who = await requireTasksActor();
  const sites = await templateSites(who);
  const [settings, templates] = await Promise.all([
    siteSettings(sites.map((s) => s.id)),
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined, status: "published" }, select: { siteIds: true } }),
  ]);
  return {
    who,
    sites: sites.map((s) => ({ ...s, ...settings.get(s.id)!, templates: templates.filter((t) => !t.siteIds.length || t.siteIds.includes(s.id)).length })),
  };
}
