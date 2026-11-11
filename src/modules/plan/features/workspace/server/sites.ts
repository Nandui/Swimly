import "server-only";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { pickSiteId, planSites } from "@/modules/plan/shared/scope";

/** The site picker's list, in the pages' order, and the site a page opens at without `?site=`:
 *  the one last picked, else the first. */
export async function planWorkspaceSites() {
  const sites = await planSites(await requirePlanActor());
  return { sites: sites.map(({ id, name }) => ({ id, name })), home: (await pickSiteId(sites, undefined)) ?? null };
}
