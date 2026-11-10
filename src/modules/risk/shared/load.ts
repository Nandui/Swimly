import "server-only";
import { departmentById, siteName } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAt, requireRiskActor } from "@/modules/risk/shared/access";
import { hazardReference, highestScore, overallScore, reviewStateOf } from "@/modules/risk/shared/rules";
import { assessmentView, hazardView, requestView, reviewView } from "@/modules/risk/shared/service";
import type { RiskAction, RiskHistory } from "@/modules/risk/shared/types";

/** One assessment with everything on its page, for anyone who reads at its site (a draft: who
 *  writes there); a RiskError, "not available", otherwise. What this person may do rides along, so
 *  the page shows only the buttons that will work. */
export async function getRiskAssessment(id: string) {
  const who = await requireRiskActor();
  const row = await prisma.riskAssessment.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  const at = await requireAt(who, row, "risk.read");
  const a = row!;
  const [site, department, hazards, reviews, requests, events] = await Promise.all([
    siteName(a.siteId),
    a.departmentId ? departmentById(a.departmentId, a.orgId, { liveOnly: false }) : null,
    prisma.riskHazard.findMany({ where: { assessmentId: id, removedAt: null }, orderBy: [{ sortOrder: "asc" }, { seq: "asc" }] }),
    prisma.riskReview.findMany({ where: { assessmentId: id }, orderBy: [{ reviewedOn: "desc" }, { createdAt: "desc" }] }),
    prisma.riskReviewRequest.findMany({ where: { assessmentId: id }, orderBy: [{ createdAt: "desc" }], take: 100 }),
    prisma.riskEvent.findMany({ where: { assessmentId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, action: true, actorName: true, note: true, createdAt: true } }),
  ]);
  const seqs = new Map(hazards.map((h) => [h.id, h.seq]));
  const owner = !!a.ownerId && a.ownerId === who.id;
  const live = a.status !== "archived";
  const history: RiskHistory[] = events.map((e) => ({ ...e, action: e.action as RiskAction, createdAt: e.createdAt.toISOString() }));
  return {
    who, assessment: assessmentView(a, site, department?.name ?? ""),
    hazards: hazards.map((h) => hazardView(h, a.reference)),
    reviews: reviews.map(reviewView),
    requests: requests.map((r) => requestView(r, r.hazardId && seqs.has(r.hazardId) ? hazardReference(a.reference, seqs.get(r.hazardId)!) : "")),
    history,
    overall: overallScore(hazards), highest: highestScore(hazards), review: reviewStateOf(a, today()),
    can: {
      write: at.write && live,
      submit: at.write && a.status === "draft",
      ownerApprove: at.write && owner && a.status === "review",
      ownerWithdraw: at.write && owner && a.status === "approved",
      execApprove: at.signoff && !owner && a.status === "approved" && !a.execApprovedAt,
      execWithdraw: at.signoff && !owner && !!a.execApprovedAt && live,
      archive: at.manage && live,
      restore: at.manage && !live,
      review: at.write && a.status === "approved",
      request: at.read && (a.status === "review" || a.status === "approved"),
      answer: at.write && live,
      print: at.read,
    },
  };
}
export type RiskAssessmentData = Awaited<ReturnType<typeof getRiskAssessment>>;
