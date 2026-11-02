import "server-only";
import { requireSession } from "@/lib/authz";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { hrConfigured, hrDatabase } from "@/modules/hr/shared/database";
import { unreadReports } from "@/modules/hr/shared/reports";

/** HR on the home page: reports from managers on duty waiting for the centre
 *  managers of the site they came from (D22). A count only: the home page
 *  never loads a report. One person's reports open their file; more open People. */
export async function reportHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("hr.records.read") || !hrConfigured()) return [];
  const session = await requireSession();
  const unread = await unreadReports(hrDatabase(), { id: viewer.id, orgId: session.user.orgId ?? "" });
  if (unread.size === 0) return [];
  const count = [...unread.values()].reduce((sum, n) => sum + n, 0);
  const href = unread.size === 1 ? `/hr/people/${[...unread.keys()][0]}` : "/hr";
  return [{ label: "Staff reports to read", hint: "From managers on duty", href, count, attention: true }];
}
