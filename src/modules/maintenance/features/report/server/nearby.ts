"use server";

import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireMaintenanceActor } from "@/modules/maintenance/shared/access";
import { maintenanceNumber, OPEN_STATUSES } from "@/modules/maintenance/shared/types";

/** The open requests already reported in one area, so the form can say "Already reported? Check
 *  these first." A read the report form calls as the area changes, so it is a server action that
 *  still checks `maintenance.report` at the site. */
export async function openInArea(siteId: string, area: string) {
  const who = await requireMaintenanceActor();
  if (!siteId || !area || !(await mayFor("maintenance.report", { siteId, orgId: who.orgId }))) return [];
  const rows = await prisma.maintenanceRequest.findMany({
    where: { orgId: who.orgId ?? undefined, siteId, area: { equals: area, mode: "insensitive" }, status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: "desc" }, take: 10, select: { id: true, number: true, title: true, place: true, status: true },
  });
  return rows.map((r) => ({ id: r.id, number: maintenanceNumber(r.number), title: r.title, place: r.place, status: r.status as (typeof OPEN_STATUSES)[number] }));
}
