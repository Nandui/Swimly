import "server-only";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { inSites } from "@/modules/stock/shared/reads";

/** Stock on the home page and its starter page (docs/stock.md): counts still open at the sites
 *  where the person counts, so a count started yesterday is not forgotten. */
export async function stockHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("stock.count")) return [];
  const open = await prisma.stockTake.count({ where: { submittedAt: null, ...inSites(await sitesFor("stock.count")) } });
  return open ? [{ label: "Stock counts to finish", hint: "Count what is left, then submit", href: "/stock", count: open, attention: true }] : [];
}
