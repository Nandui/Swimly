import "server-only";
import { departmentIdsOf, departmentsForSite, liveSiteById, liveSitesWithin } from "@/lib/directory";
import { mayFor, sitesFor } from "@/lib/policy/session";
import type { PlanActor } from "@/modules/plan/shared/access";

/** Where a person may read and write Plan (test). Manage at a site plans every department there;
 *  Plan only the departments the person belongs to. */

/** The sites the person sees the plan at, in order; the first is the default. */
export async function planSites(who: PlanActor) {
  return liveSitesWithin(who.orgId, await sitesFor("plan.view"));
}

/** One site the person may view, with its organisation, or null. */
export async function viewableSite(siteId: string) {
  const site = await liveSiteById(siteId);
  if (!site?.orgId || !(await mayFor("plan.view", { siteId: site.id, orgId: site.orgId }))) return null;
  return { id: site.id, name: site.name, orgId: site.orgId };
}

export async function mayManage(siteId: string, orgId: string) {
  return mayFor("plan.manage", { siteId, orgId });
}

/** Whether the person may plan this department at this site. */
export async function mayPlanDepartment(who: PlanActor, siteId: string, orgId: string, departmentId: string) {
  if (await mayManage(siteId, orgId)) return true;
  if (!(await mayFor("plan.plan", { siteId, orgId }))) return false;
  return (await departmentIdsOf(who.id)).includes(departmentId);
}

/** Every department the site uses, and those the person may plan there. */
export async function plannableDepartments(who: PlanActor, siteId: string, orgId: string) {
  const all = await departmentsForSite(orgId, siteId);
  if (await mayManage(siteId, orgId)) return { all, mine: all };
  if (!(await mayFor("plan.plan", { siteId, orgId }))) return { all, mine: [] };
  const own = new Set(await departmentIdsOf(who.id));
  return { all, mine: all.filter((d) => own.has(d.id)) };
}
