import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSitesOf, sitesByIds } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { covers, inSites, requireRiskActor } from "@/modules/risk/shared/access";
import { HIGH_RISK_FROM } from "@/modules/risk/shared/rules";
import { hazardView } from "@/modules/risk/shared/service";

const PAGE = 25;
/** Assessments whose hazards count: in force or waiting for sign-off. Drafts are not finished and
 *  archived ones are out of use. */
const LIVE = ["approved", "review"];

/** The hazards still High or Very high with their controls in place, at the sites this person
 *  reads at, worst first: where the next piece of work is. Paged. */
export async function highRiskHazards(params: { site?: string; page?: string }) {
  const who = await requireRiskActor();
  const [sites, allSites] = await Promise.all([sitesFor("risk.read"), liveSitesOf(who.orgId)]);
  const mySites = allSites.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = mySites.some((s) => s.id === params.site) ? params.site! : "";
  const where: Prisma.RiskHazardWhereInput = {
    orgId: who.orgId ?? undefined, removedAt: null, score: { gte: HIGH_RISK_FROM },
    assessment: { status: { in: LIVE }, ...inSites(sites), ...(site ? { siteId: site } : {}) },
  };
  const total = await prisma.riskHazard.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const rows = await prisma.riskHazard.findMany({
    where, orderBy: [{ score: "desc" }, { assessmentId: "asc" }, { seq: "asc" }], skip: (page - 1) * PAGE, take: PAGE,
    include: { assessment: { select: { id: true, reference: true, subject: true, siteId: true, targetScore: true } } },
  });
  const names = await sitesByIds(rows.map((r) => r.assessment.siteId));
  return {
    total, page, pages, site, sites: mySites,
    rows: rows.map(({ assessment, ...h }) => ({ ...hazardView(h, assessment.reference), assessmentId: assessment.id, subject: assessment.subject, siteName: names.get(assessment.siteId)?.name ?? "", targetScore: assessment.targetScore })),
  };
}
