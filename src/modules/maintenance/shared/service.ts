import "server-only";
import type { MaintenanceRequest, Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { MAINTENANCE_ACTIONS, maintenanceNumber, type MaintenanceAction, type MaintenanceView } from "@/modules/maintenance/shared/types";
import { MaintenanceError } from "@/modules/maintenance/shared/rules";
import type { MaintenanceActor } from "@/modules/maintenance/shared/access";

/** What every Maintenance write shares: the request's lock, the version check, the replay check,
 *  and the history row with its audit row in the same transaction. */

export async function lockRequest(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`maintenance:${id}`}, 0))`;
}

/** True when this operation already landed (a second press, a retry); refused when the reference
 *  was used for something else. */
export async function alreadyDone(tx: Prisma.TransactionClient, requestId: string, operationId: string, who: MaintenanceActor, action: MaintenanceAction) {
  const event = await tx.maintenanceEvent.findUnique({ where: { requestId_operationId: { requestId, operationId } }, select: { actorId: true, action: true } });
  if (!event) return false;
  if (event.actorId !== who.id || event.action !== action) throw new MaintenanceError("This step was already recorded. Refresh the page.");
  return true;
}

export function guardVersion(row: { version: number }, version: number) {
  if (row.version !== version) throw new MaintenanceError("This request changed while you were looking at it. Refresh the page to see the latest, then try again.");
}

/** One step: its history row and its audit row, beside the write that made it. */
export async function recordStep(tx: Prisma.TransactionClient, row: Pick<MaintenanceRequest, "id" | "orgId" | "siteId" | "number" | "title">, who: MaintenanceActor, action: MaintenanceAction, operationId: string, note = "", site?: string) {
  await tx.maintenanceEvent.create({ data: { orgId: row.orgId, requestId: row.id, operationId, actorId: who.id, actorName: who.name, action, note } });
  await logAudit({
    actorId: who.id, actorName: who.name, entity: "MaintenanceRequest", entityId: row.id, clubId: row.siteId, action,
    summary: `${maintenanceNumber(row.number)}${site ? ` at ${site}` : ""}: ${row.title}. ${MAINTENANCE_ACTIONS[action]}${note ? `: ${note}` : ""}`.slice(0, 1000),
  }, tx);
}

/** A request for screens, through an allowlist: no bytes, no ids of Core rows beyond the site's. */
export function maintenanceView(row: MaintenanceRequest, siteName: string, duplicateOf: MaintenanceView["duplicateOf"] = null): MaintenanceView {
  return {
    id: row.id, number: row.number, status: row.status as MaintenanceView["status"], version: row.version,
    siteId: row.siteId, siteName, area: row.area, place: row.place, title: row.title, details: row.details,
    urgency: row.urgency as MaintenanceView["urgency"], risk: row.risk as MaintenanceView["risk"],
    trackplan: row.trackplan as MaintenanceView["trackplan"], trackplanRef: row.trackplanRef, outcome: row.outcome, duplicateOf,
    reportedById: row.reportedById, reportedByName: row.reportedByName, closedByName: row.closedByName, closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
