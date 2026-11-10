import "server-only";
import type { PlatformEvents } from "@/platform/events";
import { prisma } from "@/lib/prisma";
import { hazardReference } from "@/modules/risk/shared/rules";
import { alreadyDone, lockAssessment, recordStep } from "@/modules/risk/shared/service";

/** An incident named hazards and asked for their assessments to be looked at again (listened to in
 *  module.ts): each assessment in use at that site gets one review request, in the name of whoever
 *  flagged them, with the incident's number on it. While a request from the same incident is still
 *  to answer, another flag raises nothing new. Returns how many requests were raised. */
export async function raiseFromIncident(event: PlatformEvents["incidents.hazards.flagged"]): Promise<number> {
  const hazards = await prisma.riskHazard.findMany({
    where: { id: { in: event.hazardIds }, orgId: event.orgId, removedAt: null, assessment: { siteId: event.siteId, status: { in: ["approved", "review"] } } },
    orderBy: { seq: "asc" }, select: { id: true, seq: true, assessmentId: true },
  });
  const who = { id: event.flaggedById, name: event.flaggedByName };
  let raised = 0;
  for (const assessmentId of new Set(hazards.map((h) => h.assessmentId))) {
    const mine = hazards.filter((h) => h.assessmentId === assessmentId);
    raised += await prisma.$transaction(async (tx) => {
      await lockAssessment(tx, assessmentId);
      if (await alreadyDone(tx, assessmentId, event.operationId, who, "request")) return 0;
      if (await tx.riskReviewRequest.findFirst({ where: { assessmentId, sourceIncidentId: event.incidentId, status: "open" }, select: { id: true } })) return 0;
      const row = await tx.riskAssessment.findUniqueOrThrow({ where: { id: assessmentId } });
      const refs = mine.map((h) => hazardReference(row.reference, h.seq)).join(", ");
      const notes = `Linked to incident ${event.incident}${mine.length > 1 ? ` (${refs})` : ""}.${event.note ? ` ${event.note}` : ""}`;
      await tx.riskReviewRequest.create({
        data: { orgId: row.orgId, siteId: row.siteId, assessmentId, hazardId: mine.length === 1 ? mine[0].id : null, requestedById: who.id, requestedByName: who.name, notes, sourceIncidentId: event.incidentId, sourceIncidentRef: event.incident },
      });
      await recordStep(tx, row, who, "request", event.operationId, notes);
      return 1;
    });
  }
  return raised;
}
