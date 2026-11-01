import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { withSites } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import type { AreaRename } from "@/modules/contributions";
import { maintenanceNumber } from "@/modules/maintenance/shared/types";

/** The requests a person reported, for HR's subject access export (registered in module.ts):
 *  everything Maintenance holds about them, which is their name on what they reported. */
export async function maintenanceSubjectRecords(userId: string, orgId: string) {
  const rows = await prisma.maintenanceRequest.findMany({
    where: { orgId, reportedById: userId }, orderBy: { createdAt: "asc" },
    select: { number: true, siteId: true, area: true, title: true, status: true, createdAt: true },
  });
  return (await withSites(rows, "siteId", "site")).map((r) => ({ request: maintenanceNumber(r.number), site: r.site.name, area: r.area, problem: r.title, status: r.status, reportedAt: r.createdAt.toISOString() }));
}

/** A site's area renamed in Admin: its requests follow, so they still read the same way. */
export async function renameMaintenanceAreas({ siteId, from, to }: AreaRename, tx?: unknown) {
  const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
  const { count } = await db.maintenanceRequest.updateMany({ where: { siteId, area: { equals: from, mode: "insensitive" } }, data: { area: to } });
  return count;
}
