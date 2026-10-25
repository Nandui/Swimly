import "server-only";
import { liveSitesOf } from "@/lib/directory";
import { appSwitchesOf, describeSwitch, type AppSwitchState } from "@/lib/apps/switches";
import { groupModules, switchableApps } from "@/modules/registry";

/** Admin › Apps: every app with its switch, group by group, and the organisation's live sites to
 *  choose from. The caller has already checked the person is a superadmin. */
export async function appSwitchList(orgId: string | null) {
  const [switches, sites] = await Promise.all([appSwitchesOf(orgId), liveSitesOf(orgId)]);
  const nameOf = new Map(sites.map((site) => [site.id, site.name]));
  const groups = groupModules(switchableApps()).map((group) => ({
    key: group.key,
    label: group.label,
    apps: group.modules.map((app) => {
      const setting = switches.get(app.id);
      const state: AppSwitchState = setting?.state ?? "on";
      // A site since archived is left out of the line and the ticks.
      const siteIds = state === "sites" ? (setting?.siteIds ?? []).filter((id) => nameOf.has(id)) : [];
      return { id: app.id, name: app.name, icon: app.icon, state, siteIds, where: describeSwitch(state, siteIds.map((id) => nameOf.get(id)!)) };
    }),
  }));
  return { groups, sites: sites.map(({ id, name }) => ({ id, name })) };
}
