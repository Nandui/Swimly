import "server-only";
import { areaNamesAt, liveSitesOf } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { covers, requireMaintenanceActor } from "@/modules/maintenance/shared/access";

/** What the report form offers: the sites this person reports at, each with its areas, and the
 *  site to start on (their working site when they report there, else the only one). */
export async function reportFormData(workingSiteId: string | null) {
  const who = await requireMaintenanceActor();
  const [sites, all] = await Promise.all([sitesFor("maintenance.report"), liveSitesOf(who.orgId)]);
  const open = all.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const areas = Object.fromEntries(await Promise.all(open.map(async (s) => [s.id, await areaNamesAt(s.id)] as const))) as Record<string, string[]>;
  const start = open.find((s) => s.id === workingSiteId)?.id ?? (open.length === 1 ? open[0].id : "");
  return { sites: open, areas, start };
}
