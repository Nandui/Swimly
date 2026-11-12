import "server-only";
import { sitesFor } from "@/lib/policy/session";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { waitingCounts } from "@/modules/risk/features/reviews/server/data";
import { requireRiskActor } from "@/modules/risk/shared/access";

/** Risk assessments on Home and its starter page (registered in module.ts). Writers see what waits
 *  at their sites: the assessments for them to sign off, the reviews that are overdue and the
 *  review requests to answer, and get the start action. Readers have nothing waiting on them. */
export async function riskHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("risk.read")) return [];
  const who = await requireRiskActor();
  if (!who.write) return [];
  const { overdue, requests, toSign } = await waitingCounts(who, await sitesFor("risk.write"));
  const items: HomeItem[] = [];
  if (toSign) items.push({ label: "Risk assessments for you to sign off", hint: "You own them", href: "/risk-assessments?show=review", count: toSign, attention: true });
  items.push({ label: "Risk assessment reviews overdue", hint: "Past their review day", href: "/risk-assessments/reviews", count: overdue, attention: overdue > 0 });
  if (requests) items.push({ label: "Risk review requests to answer", hint: "Someone asked for another look", href: "/risk-assessments/reviews", count: requests, attention: true });
  items.push({ kind: "action", icon: "filePlus", label: "Start a risk assessment", href: "/risk-assessments/new" });
  return items;
}
