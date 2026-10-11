import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { incidentCounts } from "@/modules/incidents/features/reports/server/data";

/** Incidents on Home and its starter page: reports to triage, serious ones to
 *  sign off, what is under investigation, and reporting one. Registered in module.ts. */
export async function incidentHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("incidents.reports.create")) return [];
  const items: HomeItem[] = [{ kind: "action", icon: "filePlus", label: "Report an incident", href: "/incidents/new" }];
  if (!held.has("incidents.reports.review")) return items;
  const counts = await incidentCounts();
  if (counts.toTriage) items.push({ label: "Incident reports to triage", href: "/incidents#to-triage", count: counts.toTriage, attention: true });
  if (counts.toSignOff) items.push({ label: "Serious incidents to sign off", href: "/incidents#investigating", count: counts.toSignOff, attention: true });
  const others = counts.investigating - counts.toSignOff;
  if (others > 0) items.push({ label: "Incidents under investigation", href: "/incidents#investigating", count: others });
  return items;
}
