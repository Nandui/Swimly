import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** The CCTV log on the home page and its starter page (docs/cctv.md): a quick way to record a
 *  viewing straight after watching footage, for those who may. */
export async function cctvHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("cctv.record")) return [];
  return [{ kind: "action", label: "Record a CCTV viewing", href: "/cctv/new", icon: "filePlus" }];
}
