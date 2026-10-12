import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { liveSitesOf } from "@/lib/directory";
import { today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { covers, inSites, requireIncidentsActor } from "@/modules/incidents/shared/access";
import { KEEP_YEARS, keepUntil, monthsEnding, summarise } from "@/modules/incidents/shared/rules";

export const PERIODS = [3, 6, 12] as const;
export type Period = (typeof PERIODS)[number];

/** Insights for those who triage (docs/incidents.md): what happened over the
 *  last few months at the sites they cover, or one of them. Counts only, never
 *  names or injuries. Manage holders also see reports past their keeping period. */
export async function incidentInsights(query: { months?: string; site?: string }) {
  const who = await requireIncidentsActor();
  if (!who.review) notFound();
  const months = (PERIODS as readonly number[]).includes(Number(query.months)) ? (Number(query.months) as Period) : 12;
  const [reviewSites, all] = await Promise.all([sitesFor("incidents.reports.review"), liveSitesOf(who.orgId)]);
  const sites = all.filter((s) => covers(reviewSites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = sites.find((s) => s.id === query.site) ?? null;
  const now = today();
  const span = monthsEnding(now, months);
  const where = { orgId: who.orgId ?? undefined, ...(site ? { siteId: site.id } : inSites(reviewSites)) };
  const [rows, overdueActions, openActions] = await Promise.all([
    prisma.incidentReport.findMany({
      where: { ...where, occurredOn: { gte: `${span[0]}-01` } },
      select: { siteId: true, area: true, kind: true, category: true, occurredOn: true, occurredAt: true, serious: true, hsaReportable: true, severityActual: true, severityPotential: true },
    }),
    prisma.incidentAction.count({ where: { status: "open", dueOn: { lt: now }, report: where } }),
    prisma.incidentAction.count({ where: { status: "open", report: where } }),
  ]);
  return { who, months, sites, site, span, overdueActions, openActions, insights: summarise(rows, span), toReview: who.signoff ? await pastKeeping(where, now) : null };
}
export type IncidentInsights = Awaited<ReturnType<typeof incidentInsights>>;

/** Closed reports whose keeping period has ended (10 years, 21 with a child).
 *  Listed for a Manage holder to decide on; nothing is ever deleted here. */
async function pastKeeping(where: { orgId?: string; siteId?: string | { in: string[] } }, now: string) {
  const [y, m, d] = now.split("-");
  const oldest = `${Number(y) - KEEP_YEARS}-${m}-${d}`;
  const rows = await prisma.incidentReport.findMany({
    where: { ...where, status: "closed", occurredOn: { lte: oldest } },
    orderBy: { occurredOn: "asc" }, take: 200,
    select: { id: true, number: true, occurredOn: true, kind: true, people: { select: { ageGroup: true } } },
  });
  return rows
    .map(({ people, ...r }) => ({ ...r, keepUntil: keepUntil(r.occurredOn, people.some((p) => p.ageGroup === "child")) }))
    .filter((r) => r.keepUntil <= now);
}
