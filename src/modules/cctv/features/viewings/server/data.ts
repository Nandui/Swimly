import "server-only";
import { notFound } from "next/navigation";
import { liveSitesWithin, withSite, withSites } from "@/lib/directory";
import { today } from "@/lib/format";
import { holdsAnywhere } from "@/lib/policy/engine";
import { currentActor, mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireCctvActor } from "@/modules/cctv/shared/access";

/** The reads (docs/cctv.md). Record shows a person their own entries; Review adds every entry at
 *  the sites it covers. An entry outside both is a 404. */

const ROW = { id: true, number: true, siteId: true, viewedOn: true, viewedAt: true, checkedBy: true, reason: true, purpose: true, incidentNumber: true, recordedById: true, recordedByName: true, _count: { select: { notes: true } } } as const;

/** The log: newest first, the person's own and, for Review, everyone's at their sites. */
export async function cctvViewings() {
  const who = await requireCctvActor();
  const reviewSites = who.review ? await sitesFor("cctv.review") : null;
  const reach = reviewSites?.kind === "all" ? {}
    : { OR: [{ recordedById: who.id }, ...(reviewSites ? [{ siteId: { in: [...reviewSites.siteIds] } }] : [])] };
  const rows = await prisma.cctvViewing.findMany({
    where: { orgId: who.orgId ?? undefined, ...reach },
    orderBy: [{ viewedOn: "desc" }, { viewedAt: "desc" }, { number: "desc" }], take: 300, select: ROW,
  });
  return { who, rows: (await withSites(rows, "siteId", "site")).map((r) => ({ ...r, notes: r._count.notes, mine: r.recordedById === who.id })) };
}
export type CctvViewingRow = Awaited<ReturnType<typeof cctvViewings>>["rows"][number];

/** The form: the sites where the person may record, and today's date and the person's name. */
export async function cctvFormData() {
  const who = await requireCctvActor();
  const sites = await liveSitesWithin(who.orgId, await sitesFor("cctv.record"));
  return { who, sites: sites.map((s) => ({ id: s.id, name: s.name })), today: today() };
}

/** One entry and its notes. The person who recorded it reads it; so does Review at its site. */
export async function cctvViewing(id: string) {
  const who = await requireCctvActor();
  const found = await prisma.cctvViewing.findFirst({ where: { id, orgId: who.orgId ?? undefined }, include: { notes: { orderBy: { createdAt: "asc" } } } });
  if (!found) notFound();
  const mine = found.recordedById === who.id;
  const review = await mayFor("cctv.review", { siteId: found.siteId, orgId: found.orgId });
  if (!mine && !review) notFound();
  // A link to the incident report only for those who can open Incidents; the report page checks the rest.
  const canOpenIncidents = holdsAnywhere(await currentActor(), "incidents.reports.create");
  return { viewing: await withSite(found, "siteId", "site"), canNote: mine || review, canOpenIncidents };
}
export type CctvViewingDetail = Awaited<ReturnType<typeof cctvViewing>>;
