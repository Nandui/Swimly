import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { requireMaintenanceActor } from "@/modules/maintenance/shared/access";
import { managerCounts, ownOpenCount } from "@/modules/maintenance/features/requests/server/data";

/** Maintenance on Home and its starter page (registered in module.ts). Managers see what is still
 *  to put in Trackplan and what is urgent at their sites; everyone gets the report action. A
 *  reporter's own open requests sit on the starter page only: nothing there waits on them. */
export async function maintenanceHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("maintenance.report")) return [];
  const who = await requireMaintenanceActor();
  const items: HomeItem[] = [];
  if (who.manage) {
    const { toTrackplan, urgent } = await managerCounts(who.orgId);
    items.push({ label: "Maintenance to put in Trackplan", hint: "Reported, not in Trackplan yet", href: "/maintenance?show=trackplan", count: toTrackplan, attention: toTrackplan > 0 });
    if (urgent) items.push({ label: "Urgent maintenance still open", hint: "Out of use or could hurt someone", href: "/maintenance?show=open", count: urgent, attention: true });
  }
  const mine = await ownOpenCount(who);
  if (mine) items.push({ label: "Your maintenance requests still open", hint: "Reported by you, not fixed yet", href: "/maintenance?show=mine", count: mine });
  items.push({ kind: "action", icon: "filePlus", label: "Report a maintenance problem", href: "/maintenance/new" });
  return items;
}
