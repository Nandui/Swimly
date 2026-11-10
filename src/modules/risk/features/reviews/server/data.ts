import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSitesOf, sitesByIds } from "@/lib/directory";
import { addDaysIso, today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { covers, inSites, requireRiskActor, type Sites } from "@/modules/risk/shared/access";
import { reviewStateOf } from "@/modules/risk/shared/rules";
import { assessmentView, requestView } from "@/modules/risk/shared/service";
import { DUE_SOON_DAYS } from "@/modules/risk/shared/types";

/** How many rows each list on the Reviews page shows; its count says when there are more. */
const SHOWN = 50;

const overdueAt = (day: string): Prisma.RiskAssessmentWhereInput => ({ status: "approved", nextReviewOn: { lt: day } });
const dueSoonAt = (day: string): Prisma.RiskAssessmentWhereInput => ({ status: "approved", nextReviewOn: { gte: day, lte: addDaysIso(day, DUE_SOON_DAYS) } });
/** Requests still to answer on assessments that are not archived. */
const openRequests = { status: "open", assessment: { status: { not: "archived" } } } satisfies Prisma.RiskReviewRequestWhereInput;

/** The Reviews page, at the sites this person reads at: review requests still to answer, the
 *  assessments whose review is overdue (longest first) and those due in the next 30 days. */
export async function reviewsDue(params: { site?: string }) {
  const who = await requireRiskActor();
  const [sites, allSites] = await Promise.all([sitesFor("risk.read"), liveSitesOf(who.orgId)]);
  const mySites = allSites.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = mySites.some((s) => s.id === params.site) ? params.site! : "";
  const at = { orgId: who.orgId ?? undefined, ...inSites(sites), ...(site ? { siteId: site } : {}) };
  const day = today();
  const [requests, requestCount, overdue, overdueCount, due, dueCount] = await Promise.all([
    prisma.riskReviewRequest.findMany({ where: { ...at, ...openRequests }, orderBy: { createdAt: "asc" }, take: SHOWN, include: { assessment: { select: { reference: true, subject: true } } } }),
    prisma.riskReviewRequest.count({ where: { ...at, ...openRequests } }),
    prisma.riskAssessment.findMany({ where: { ...at, ...overdueAt(day) }, orderBy: [{ nextReviewOn: "asc" }, { id: "asc" }], take: SHOWN }),
    prisma.riskAssessment.count({ where: { ...at, ...overdueAt(day) } }),
    prisma.riskAssessment.findMany({ where: { ...at, ...dueSoonAt(day) }, orderBy: [{ nextReviewOn: "asc" }, { id: "asc" }], take: SHOWN }),
    prisma.riskAssessment.count({ where: { ...at, ...dueSoonAt(day) } }),
  ]);
  const names = await sitesByIds([...requests, ...overdue, ...due].map((r) => r.siteId));
  const row = (r: (typeof overdue)[number]) => ({ ...assessmentView(r, names.get(r.siteId)?.name ?? ""), review: reviewStateOf(r, day) });
  return {
    who, site, sites: mySites, shown: SHOWN,
    requests: requests.map(({ assessment, ...r }) => ({ ...requestView(r), reference: assessment.reference, subject: assessment.subject, siteName: names.get(r.siteId)?.name ?? "" })), requestCount,
    overdue: overdue.map(row), overdueCount, due: due.map(row), dueCount,
  };
}

/** For Home and the starter page: what waits at the sites this person writes at, and the
 *  assessments waiting for their own sign-off. */
export async function waitingCounts(who: { id: string; orgId: string | null }, writeSites: Sites) {
  const at = { orgId: who.orgId ?? undefined, ...inSites(writeSites) };
  const day = today();
  const [overdue, requests, toSign] = await Promise.all([
    prisma.riskAssessment.count({ where: { ...at, ...overdueAt(day) } }),
    prisma.riskReviewRequest.count({ where: { ...at, ...openRequests } }),
    prisma.riskAssessment.count({ where: { ...at, status: "review", ownerId: who.id } }),
  ]);
  return { overdue, requests, toSign };
}
