import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { activeStaffAtSite, activeStaffHolding, areaNamesAt, departmentsForSite, livePositionsOf, liveSitesOf, withSites } from "@/lib/directory";
import { today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { covers, inSites, requireRiskActor } from "@/modules/risk/shared/access";
import { reviewStateOf } from "@/modules/risk/shared/rules";
import { assessmentView } from "@/modules/risk/shared/service";

export const VIEWS = ["approved", "review", "draft", "archived"] as const;
export type View = (typeof VIEWS)[number];
const PAGE = 25;

/** The lists on /risk-assessments, at the sites this person reads at: those in force with the
 *  soonest review first, those waiting for sign-off, the drafts (for writers, at the sites they
 *  write at) and the archived. One view at a time, paged, with every view's count. */
export async function riskLists(params: { show?: string; site?: string; page?: string }) {
  const who = await requireRiskActor();
  const [sites, writeSites, allSites] = await Promise.all([sitesFor("risk.read"), sitesFor("risk.write"), liveSitesOf(who.orgId)]);
  const mySites = allSites.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = mySites.some((s) => s.id === params.site) ? params.site! : "";
  const base: Prisma.RiskAssessmentWhereInput = { orgId: who.orgId ?? undefined, ...inSites(sites), ...(site ? { siteId: site } : {}) };
  const where: Record<View, Prisma.RiskAssessmentWhereInput> = {
    approved: { ...base, status: "approved" },
    review: { ...base, status: "review" },
    draft: { AND: [base, inSites(writeSites), { status: "draft" }] },
    archived: { ...base, status: "archived" },
  };
  const views = VIEWS.filter((v) => v !== "draft" || who.write);
  const show: View = views.includes(params.show as View) ? params.show as View : "approved";
  const orderBy: Prisma.RiskAssessmentOrderByWithRelationInput[] = show === "approved" ? [{ nextReviewOn: "asc" }] : [{ updatedAt: "desc" }];
  const counts = Object.fromEntries(await Promise.all(views.map(async (v) => [v, await prisma.riskAssessment.count({ where: where[v] })] as const))) as Partial<Record<View, number>>;
  const pages = Math.max(1, Math.ceil((counts[show] ?? 0) / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const rows = await prisma.riskAssessment.findMany({ where: where[show], orderBy: [...orderBy, { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE });
  const hazards = await prisma.riskHazard.groupBy({ by: ["assessmentId"], where: { assessmentId: { in: rows.map((r) => r.id) }, removedAt: null }, _count: { _all: true }, _max: { score: true } });
  const byId = new Map(hazards.map((h) => [h.assessmentId, h]));
  const day = today();
  const named = await withSites(rows, "siteId", "site");
  return {
    who, show, views, counts, page, pages, site, sites: mySites,
    rows: named.map((r) => ({ ...assessmentView(r, r.site.name), hazards: byId.get(r.id)?._count._all ?? 0, highest: byId.get(r.id)?._max.score ?? null, review: reviewStateOf(r, day) })),
  };
}
export type RiskListRow = Awaited<ReturnType<typeof riskLists>>["rows"][number];

/** What one site offers the details form: its areas, its departments and who can own an
 *  assessment there (active staff at the site whose role writes risk assessments). */
export async function siteChoices(orgId: string | null, siteId: string) {
  const [areas, departments, atSite, writers] = await Promise.all([
    areaNamesAt(siteId), departmentsForSite(orgId, siteId), activeStaffAtSite(orgId, siteId), activeStaffHolding(["risk.write", "risk.manage"]),
  ]);
  const writes = new Set(writers.map((w) => w.id));
  return { areas, departments, owners: atSite.filter((p) => writes.has(p.id)).map(({ id, name, jobTitle }) => ({ id, name, jobTitle })) };
}
export type SiteChoices = Awaited<ReturnType<typeof siteChoices>>;

/** What the details form offers: the sites this person writes at, each with its choices, the
 *  organisation's positions (the jobs an assessment can be about), and the site to start on
 *  (their working site when they write there, else the only one). `only` narrows it to one site,
 *  for changing an assessment that is already there. */
export async function detailsFormData(workingSiteId: string | null, only?: string) {
  const who = await requireRiskActor();
  const [sites, all, positions] = await Promise.all([sitesFor("risk.write"), liveSitesOf(who.orgId), livePositionsOf(who.orgId)]);
  const open = all.filter((s) => covers(sites, s.id) && (!only || s.id === only)).map(({ id, name }) => ({ id, name }));
  const choices = Object.fromEntries(await Promise.all(open.map(async (s) => [s.id, await siteChoices(who.orgId, s.id)] as const))) as Record<string, SiteChoices>;
  const start = open.find((s) => s.id === workingSiteId)?.id ?? (open.length === 1 ? open[0].id : "");
  return { sites: open, choices, jobs: positions.map((p) => p.name), start, today: today() };
}
export type DetailsFormData = Awaited<ReturnType<typeof detailsFormData>>;
