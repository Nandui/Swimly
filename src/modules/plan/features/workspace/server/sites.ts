import "server-only";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { planSites } from "@/modules/plan/shared/scope";

/** The site picker's list, in the pages' order (its first site is their default). */
export async function planWorkspaceSites() {
  const sites = await planSites(await requirePlanActor());
  return sites.map(({ id, name }) => ({ id, name }));
}
