import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { openMonitoringCount } from "@/modules/site-monitoring/features/actions/server/data";
import { requireMonitoringActor } from "@/modules/site-monitoring/shared/access";

/** Site Monitoring on the home page and its starter page: the open actions at the person's sites.
 *  Counts only. Registered in module.ts. */
export async function monitoringHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("site-monitoring.read")) return [];
  const who = await requireMonitoringActor();
  const open = await openMonitoringCount(who.orgId);
  return open ? [{ label: "Readings out of range to act on", hint: "Say what was done to close each", href: "/site-monitoring", count: open, attention: true }] : [];
}
