import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSitesOf, siteName, withSites } from "@/lib/directory";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { covers, inSites, requireMaintenanceActor } from "@/modules/maintenance/shared/access";
import { MaintenanceError } from "@/modules/maintenance/shared/rules";
import { maintenanceView } from "@/modules/maintenance/shared/service";
import { MAX_PHOTOS, OPEN_STATUSES, type MaintenanceAction, type MaintenanceHistory } from "@/modules/maintenance/shared/types";

export const VIEWS = ["open", "trackplan", "mine", "closed"] as const;
export type View = (typeof VIEWS)[number];
const PAGE = 25;

/** The lists on /maintenance, at the sites this person reports at: open ones urgent first then
 *  oldest, those still to put in Trackplan (for Manage), their own, and the closed ones newest
 *  first. One view at a time, paged, with every view's count for the switcher. */
export async function maintenanceLists(params: { show?: string; site?: string; page?: string }) {
  const who = await requireMaintenanceActor();
  const [sites, manageSites, allSites] = await Promise.all([sitesFor("maintenance.report"), sitesFor("maintenance.manage"), liveSitesOf(who.orgId)]);
  const mySites = allSites.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = mySites.some((s) => s.id === params.site) ? params.site! : "";
  const base: Prisma.MaintenanceRequestWhereInput = { orgId: who.orgId ?? undefined, ...inSites(sites), ...(site ? { siteId: site } : {}) };
  const open = { status: { in: [...OPEN_STATUSES] } };
  const where: Record<View, Prisma.MaintenanceRequestWhereInput> = {
    open: { ...base, ...open },
    trackplan: { AND: [base, inSites(manageSites), { status: "reported" }] },
    mine: { ...base, reportedById: who.id },
    closed: { ...base, status: { in: ["fixed", "closed"] } },
  };
  const views = VIEWS.filter((v) => v !== "trackplan" || who.manage);
  const fallback: View = who.manage ? "trackplan" : "open";
  const show: View = views.includes(params.show as View) ? params.show as View : fallback;
  const orderBy: Record<View, Prisma.MaintenanceRequestOrderByWithRelationInput[]> = {
    open: [{ urgency: "desc" }, { createdAt: "asc" }], trackplan: [{ urgency: "desc" }, { createdAt: "asc" }],
    mine: [{ createdAt: "desc" }], closed: [{ closedAt: "desc" }],
  };
  const counts = Object.fromEntries(await Promise.all(views.map(async (v) => [v, await prisma.maintenanceRequest.count({ where: where[v] })] as const))) as Partial<Record<View, number>>;
  const pages = Math.max(1, Math.ceil((counts[show] ?? 0) / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const rows = await prisma.maintenanceRequest.findMany({ where: where[show], orderBy: [...orderBy[show], { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE });
  const named = await withSites(rows, "siteId", "site");
  return { who, show, views, counts, page, pages, site, sites: mySites, rows: named.map((r) => maintenanceView(r, r.site.name)) };
}

/** One request, for anyone who reports at its site; "not available" otherwise. What this person may
 *  do on it rides along, so the page shows only the buttons that will work. */
export async function getMaintenanceRequest(id: string) {
  const who = await requireMaintenanceActor();
  const row = await prisma.maintenanceRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  if (!row || !(await mayFor("maintenance.report", { siteId: row.siteId, orgId: who.orgId }))) throw new MaintenanceError("This request is not available.");
  const manage = who.manage && await mayFor("maintenance.manage", { siteId: row.siteId, orgId: who.orgId });
  const [site, events, photos, duplicateOf, candidates] = await Promise.all([
    siteName(row.siteId),
    prisma.maintenanceEvent.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, action: true, actorName: true, note: true, createdAt: true } }),
    prisma.maintenancePhoto.findMany({ where: { requestId: id, removedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, addedByName: true, createdAt: true } }),
    row.duplicateOfId ? prisma.maintenanceRequest.findFirst({ where: { id: row.duplicateOfId, orgId: row.orgId }, select: { id: true, number: true, title: true } }) : null,
    // What it might repeat, for Manage's close: the site's other open requests, newest first.
    manage ? prisma.maintenanceRequest.findMany({ where: { orgId: row.orgId, siteId: row.siteId, id: { not: id }, status: { in: [...OPEN_STATUSES] } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, number: true, title: true, area: true } }) : [],
  ]);
  const open = (OPEN_STATUSES as readonly string[]).includes(row.status);
  const own = row.reportedById === who.id;
  const history: MaintenanceHistory[] = events.map((e) => ({ ...e, action: e.action as MaintenanceAction, createdAt: e.createdAt.toISOString() }));
  return {
    who, request: maintenanceView(row, site, duplicateOf),
    history, candidates,
    photos: photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    can: { manage, addPhoto: open && (own || manage) && photos.length < MAX_PHOTOS, removePhoto: open && (own || manage) },
  };
}

/** The open requests at the sites this person manages, for Home and the starter page. */
export async function managerCounts(orgId: string | null) {
  const sites = await sitesFor("maintenance.manage");
  const where = { orgId: orgId ?? undefined, ...inSites(sites) };
  const [toTrackplan, urgent] = await Promise.all([
    prisma.maintenanceRequest.count({ where: { ...where, status: "reported" } }),
    prisma.maintenanceRequest.count({ where: { ...where, status: { in: [...OPEN_STATUSES] }, urgency: "urgent" } }),
  ]);
  return { toTrackplan, urgent };
}

/** How many of this person's own reports are still open. */
export function ownOpenCount(who: { id: string; orgId: string | null }) {
  return prisma.maintenanceRequest.count({ where: { orgId: who.orgId ?? undefined, reportedById: who.id, status: { in: [...OPEN_STATUSES] } } });
}
