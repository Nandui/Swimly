import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { mayFor } from "@/lib/policy/session";
import { incidentActions, incidentNumber, type IncidentsActor } from "@/modules/incidents/shared/types";

/** The writes every Incidents feature shares: one report at a time, every
 *  change in the report's history and in the activity log, in the same
 *  transaction (docs/incidents.md). */

export async function lockReport(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`incident:${id}`}, 0))`;
}

type Row = { id: string; number: number; siteId: string; reporterId: string };

export async function recordEvent(tx: Prisma.TransactionClient, row: Row, who: IncidentsActor, action: keyof typeof incidentActions, note = "") {
  await tx.incidentEvent.create({ data: { reportId: row.id, actorId: who.id, actorName: who.name, action, note } });
  await logAudit({
    actorId: who.id, actorName: who.name, entity: "IncidentReport", entityId: row.id, clubId: row.siteId, action,
    summary: `${incidentNumber(row.number)}: ${incidentActions[action].toLowerCase()}.`,
  }, tx);
}

/** What this person may do with this report: read it (their own, or with
 *  triage access at its site), triage it, or sign it off. */
export async function reportRights(row: Pick<Row, "siteId" | "reporterId">, who: IncidentsActor) {
  const resource = { siteId: row.siteId, orgId: who.orgId };
  const [review, signoff] = await Promise.all([
    who.review ? mayFor("incidents.reports.review", resource) : false,
    who.signoff ? mayFor("incidents.reports.signoff", resource) : false,
  ]);
  return { own: row.reporterId === who.id, review, signoff, read: row.reporterId === who.id || review };
}
