"use server";

import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRiskActor } from "@/modules/risk/shared/access";
import { addMonthsIso, answerSchema, hazardReference, problemOf, requestSchema, reviewSchema, RiskError, type AnswerInput, type RequestInput, type ReviewInput } from "@/modules/risk/shared/rules";
import { riskStep } from "@/modules/risk/shared/step";
import { OUTCOME_LABEL, type RiskResult } from "@/modules/risk/shared/types";

/** Log a review that was carried out on an assessment in force (Write at its site): what it found,
 *  and the next review moves on by the assessment's interval from that day. */
export async function logReview(input: ReviewInput): Promise<RiskResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, reviewedOn, outcome, notes } = parsed.data;
  return riskStep({ id, operationId, version, action: "review", needs: "risk.write" }, async (row, who, tx) => {
    if (row.status !== "approved") throw new RiskError("Only an assessment in force is reviewed. Refresh to see where it stands.");
    if (reviewedOn > today()) throw new RiskError("The review day cannot be in the future.");
    if (row.lastReviewedOn && reviewedOn < row.lastReviewedOn) throw new RiskError(`A later review is already logged, on ${formatDate(parseDateOnly(row.lastReviewedOn))}.`);
    const nextReviewOn = addMonthsIso(reviewedOn, row.reviewMonths);
    await tx.riskReview.create({ data: { orgId: row.orgId, assessmentId: id, reviewedOn, reviewerId: who.id, reviewerName: who.name, outcome, notes, nextReviewOn } });
    return { data: { lastReviewedOn: reviewedOn, nextReviewOn }, note: `${OUTCOME_LABEL[outcome]}. Next review ${formatDate(parseDateOnly(nextReviewOn))}.${notes ? ` ${notes}` : ""}` };
  });
}

/** Ask for an assessment, or one hazard on it, to be looked at again: anyone who reads it. The
 *  assessment itself does not change, so this never clashes with someone editing it. */
export async function askForReview(input: RequestInput): Promise<RiskResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, hazardId, notes } = parsed.data;
  return riskStep({ id, operationId, action: "request", needs: "risk.read" }, async (row, who, tx) => {
    if (row.status !== "approved" && row.status !== "review") throw new RiskError("A review can be asked for once the assessment is sent for sign-off.");
    const hazard = hazardId ? await tx.riskHazard.findFirst({ where: { id: hazardId, assessmentId: id, removedAt: null }, select: { id: true, seq: true } }) : null;
    if (hazardId && !hazard) throw new RiskError("That hazard is no longer on the assessment. Refresh the page.");
    await tx.riskReviewRequest.create({ data: { orgId: row.orgId, siteId: row.siteId, assessmentId: id, hazardId: hazard?.id ?? null, requestedById: who.id, requestedByName: who.name, notes } });
    return { note: `${hazard ? `${hazardReference(row.reference, hazard.seq)}: ` : ""}${notes}` };
  });
}

/** Answer a review request (Write at the assessment's site): acted on, with what was done, or
 *  dismissed, with why. */
export async function answerRequest(input: AnswerInput): Promise<RiskResult> {
  const who = await requireRiskActor();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { requestId, operationId, answer, note } = parsed.data;
  const request = await prisma.riskReviewRequest.findFirst({ where: { id: requestId, orgId: who.orgId ?? undefined }, select: { assessmentId: true } });
  if (!request) return { ok: false, error: "This request is not available." };
  return riskStep({ id: request.assessmentId, operationId, action: answer === "actioned" ? "request_actioned" : "request_dismissed", needs: "risk.write" }, async (_row, actor, tx) => {
    if (answer === "dismissed" && note.length < 3) throw new RiskError("Say why the request is dismissed.");
    const { count } = await tx.riskReviewRequest.updateMany({ where: { id: requestId, status: "open" }, data: { status: answer, resolvedAt: new Date(), resolvedById: actor.id, resolvedByName: actor.name, resolutionNote: note } });
    if (!count) throw new RiskError("This request was already answered. Refresh the page.");
    return { note };
  });
}
