import "server-only";
import { withSites } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";

/** The open actions this person owns, wherever they are: listed on the
 *  reports page so an owner can mark one done without opening the report. */
export async function yourActions() {
  const who = await requireIncidentsActor();
  const rows = await prisma.incidentAction.findMany({
    where: { ownerId: who.id, status: "open", report: { orgId: who.orgId ?? undefined } }, orderBy: { dueOn: "asc" },
    select: { id: true, title: true, dueOn: true, createdByName: true, report: { select: { number: true, siteId: true } } },
  });
  return { today: today(), rows: await withSites(rows.map((r) => ({ ...r, siteId: r.report.siteId })), "siteId", "site") };
}
export type YourActions = Awaited<ReturnType<typeof yourActions>>;
