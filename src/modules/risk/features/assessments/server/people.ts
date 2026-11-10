import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { withSites } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import type { AreaRename } from "@/modules/contributions";

/** What Risk assessments holds about a person, for the subject access export in HR (registered in
 *  module.ts): their name on the assessments they own or started, the reviews they logged and
 *  the reviews they asked for. */
export async function riskSubjectRecords(userId: string, orgId: string) {
  const [assessments, reviews, requests] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { orgId, OR: [{ ownerId: userId }, { createdById: userId }, { ownerApprovedById: userId }, { execApprovedById: userId }] }, orderBy: { createdAt: "asc" },
      select: { reference: true, siteId: true, subject: true, status: true, ownerId: true, createdById: true, ownerApprovedById: true, execApprovedById: true, createdAt: true },
    }),
    prisma.riskReview.findMany({ where: { orgId, reviewerId: userId }, orderBy: { reviewedOn: "asc" }, select: { reviewedOn: true, outcome: true, notes: true, assessment: { select: { reference: true } } } }),
    prisma.riskReviewRequest.findMany({ where: { orgId, requestedById: userId }, orderBy: { createdAt: "asc" }, select: { notes: true, status: true, createdAt: true, assessment: { select: { reference: true } } } }),
  ]);
  return {
    assessments: (await withSites(assessments, "siteId", "site")).map((a) => ({
      assessment: a.reference, site: a.site.name, about: a.subject, status: a.status, startedAt: a.createdAt.toISOString(),
      as: [a.ownerId === userId ? "owner" : null, a.createdById === userId ? "started it" : null, a.ownerApprovedById === userId ? "signed it off" : null, a.execApprovedById === userId ? "gave the executive sign-off" : null].filter(Boolean),
    })),
    reviews: reviews.map((r) => ({ assessment: r.assessment.reference, reviewedOn: r.reviewedOn, outcome: r.outcome, notes: r.notes })),
    reviewRequests: requests.map((r) => ({ assessment: r.assessment.reference, askedAt: r.createdAt.toISOString(), status: r.status, notes: r.notes })),
  };
}

/** A site's area renamed in Admin: the assessments about that area follow, so they still read the
 *  same way and the area keeps its one assessment. */
export async function renameRiskAreas({ siteId, from, to }: AreaRename, tx?: unknown) {
  const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
  const { count } = await db.riskAssessment.updateMany({ where: { siteId, subjectType: "area", subject: { equals: from, mode: "insensitive" } }, data: { subject: to } });
  return count;
}
