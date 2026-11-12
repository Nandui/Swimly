import "server-only";
import type { Prisma, RiskAssessment, RiskHazard, RiskReview, RiskReviewRequest } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { hazardReference, personsOf, referenceNumber, referencePrefix, RiskError, riskReference, siteCodeOf } from "@/modules/risk/shared/rules";
import { RISK_ACTIONS, type ReviewOutcome, type RequestStatus, type RiskAction, type RiskAssessmentView, type RiskCategory, type RiskHazardView, type RiskRequestView, type RiskReviewView, type RiskStatus, type SubjectType } from "@/modules/risk/shared/types";

/** What every Risk assessments write shares: the assessment's lock, the version check, the replay
 *  check, and the history row with its audit row in the same transaction. */

type Tx = Prisma.TransactionClient;
type Who = { id: string | null; name: string };

export async function lockAssessment(tx: Tx, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`risk:${id}`}, 0))`;
}

/** True when this operation already landed (a second press, a retry); refused when the reference
 *  was used for something else. */
export async function alreadyDone(tx: Tx, assessmentId: string, operationId: string, who: Who, action: RiskAction) {
  const event = await tx.riskEvent.findUnique({ where: { assessmentId_operationId: { assessmentId, operationId } }, select: { actorId: true, action: true } });
  if (!event) return false;
  if (event.actorId !== who.id || event.action !== action) throw new RiskError("This step was already recorded. Refresh the page.");
  return true;
}

export function guardVersion(row: { version: number }, version: number) {
  if (row.version !== version) throw new RiskError("This assessment changed while you were looking at it. Refresh the page to see the latest, then try again.");
}

type Named = Pick<RiskAssessment, "id" | "orgId" | "siteId" | "reference" | "subject">;
/** One step: its history row and its audit row, beside the write that made it. */
export async function recordStep(tx: Tx, row: Named, who: Who, action: RiskAction, operationId: string, note = "") {
  await tx.riskEvent.create({ data: { orgId: row.orgId, assessmentId: row.id, operationId, actorId: who.id, actorName: who.name, action, note } });
  await logAudit({
    actorId: who.id, actorName: who.name, entity: "RiskAssessment", entityId: row.id, clubId: row.siteId, action,
    summary: `${row.reference} ${row.subject}. ${RISK_ACTIONS[action]}${note ? `: ${note}` : ""}`.slice(0, 1000),
  }, tx);
}

/** The site's next reference, "RA-BT-0007", under the site's lock so two drafts never share one.
 *  Numbers brought over from the old app count, so a new one never repeats theirs. */
export async function nextReference(tx: Tx, orgId: string, site: { id: string; name: string; code?: string | null }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`risk:reference:${orgId}:${site.id}`}, 0))`;
  const prefix = referencePrefix(siteCodeOf(site));
  const taken = await tx.riskAssessment.findMany({ where: { orgId, reference: { startsWith: prefix } }, select: { reference: true } });
  return riskReference(siteCodeOf(site), Math.max(0, ...taken.map((r) => referenceNumber(r.reference, prefix))) + 1);
}

/** Another live assessment about the same thing at the site: one subject has one assessment. */
export async function sameSubject(tx: Tx, row: { id: string; orgId: string; siteId: string; subjectType: string; subject: string }) {
  return tx.riskAssessment.findFirst({
    where: { orgId: row.orgId, siteId: row.siteId, subjectType: row.subjectType, subject: { equals: row.subject, mode: "insensitive" }, status: { not: "archived" }, id: { not: row.id } },
    select: { reference: true },
  });
}

/** An assessment for screens, through an allowlist. */
export function assessmentView(row: RiskAssessment, siteName: string, departmentName = ""): RiskAssessmentView {
  return {
    id: row.id, reference: row.reference, status: row.status as RiskStatus, version: row.version,
    siteId: row.siteId, siteName, subjectType: row.subjectType as SubjectType, subject: row.subject, scope: row.scope,
    departmentId: row.departmentId, departmentName, ownerId: row.ownerId, ownerName: row.ownerName, assessorName: row.assessorName,
    assessedOn: row.assessedOn, reviewMonths: row.reviewMonths, targetScore: row.targetScore, lastReviewedOn: row.lastReviewedOn, nextReviewOn: row.nextReviewOn,
    ownerApprovedByName: row.ownerApprovedByName, ownerApprovedAt: row.ownerApprovedAt?.toISOString() ?? null,
    execApprovedById: row.execApprovedById, execApprovedByName: row.execApprovedByName, execApprovedAt: row.execApprovedAt?.toISOString() ?? null,
    createdByName: row.createdByName, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

export function hazardView(row: RiskHazard, reference: string): RiskHazardView {
  return {
    id: row.id, seq: row.seq, reference: hazardReference(reference, row.seq), hazard: row.hazard, riskFactor: row.riskFactor,
    personsAtRisk: personsOf(row.personsAtRisk), consequence: row.consequence,
    inherentLikelihood: row.inherentLikelihood, inherentSeverity: row.inherentSeverity, controls: row.controls,
    likelihood: row.likelihood, severity: row.severity, score: row.score, furtherAction: row.furtherAction, category: row.category as RiskCategory,
  };
}

export function reviewView(row: RiskReview): RiskReviewView {
  return { id: row.id, reviewedOn: row.reviewedOn, reviewerName: row.reviewerName, outcome: row.outcome as ReviewOutcome, notes: row.notes, nextReviewOn: row.nextReviewOn };
}

export function requestView(row: RiskReviewRequest, hazardLabel = ""): RiskRequestView {
  return {
    id: row.id, assessmentId: row.assessmentId, hazardId: row.hazardId, hazardLabel, requestedByName: row.requestedByName, notes: row.notes, status: row.status as RequestStatus,
    resolvedByName: row.resolvedByName, resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionNote: row.resolutionNote,
    sourceIncidentId: row.sourceIncidentId, sourceIncidentRef: row.sourceIncidentRef, createdAt: row.createdAt.toISOString(),
  };
}
