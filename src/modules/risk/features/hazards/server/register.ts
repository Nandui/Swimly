import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssessedHazard } from "@/modules/contributions";
import { hazardReference } from "@/modules/risk/shared/rules";

/** The site's assessed hazards for other apps (the hazard register plug, registered in module.ts):
 *  hazards on assessments in force or waiting for sign-off. Drafts are not finished and archived
 *  ones are out of use. The asker has checked its own permission; nothing here is personal. */

const FOUND = 20;
const inUse = (siteId: string): Prisma.RiskHazardWhereInput => ({ removedAt: null, assessment: { siteId, status: { in: ["approved", "review"] } } });
const withAssessment = { assessment: { select: { id: true, reference: true, subject: true, subjectType: true } } } as const;
type Row = Prisma.RiskHazardGetPayload<{ include: typeof withAssessment }>;

const assessed = (h: Row): AssessedHazard => ({
  id: h.id, reference: hazardReference(h.assessment.reference, h.seq), hazard: h.hazard,
  assessment: `${h.assessment.reference} ${h.assessment.subject}`, score: h.score, href: `/risk-assessments/${h.assessment.id}`,
});

/** Up to 20 hazards at the site whose words, or what their assessment is about, match `q`: those
 *  assessed for `area` first, then the highest risk. */
export async function searchHazards(siteId: string, q: string, area = ""): Promise<AssessedHazard[]> {
  const text = q.trim().slice(0, 100);
  const matches: Prisma.RiskHazardWhereInput = text
    ? { OR: [{ hazard: { contains: text, mode: "insensitive" } }, { assessment: { subject: { contains: text, mode: "insensitive" } } }, { assessment: { reference: { contains: text, mode: "insensitive" } } }] }
    : {};
  const find = (where: Prisma.RiskHazardWhereInput, take: number) =>
    prisma.riskHazard.findMany({ where: { AND: [inUse(siteId), matches, where] }, orderBy: [{ score: "desc" }, { assessmentId: "asc" }, { seq: "asc" }], take, include: withAssessment });
  const here: Prisma.RiskHazardWhereInput = { assessment: { subjectType: "area", subject: { equals: area, mode: "insensitive" } } };
  const first = area ? await find(here, FOUND) : [];
  const rest = first.length < FOUND ? await find(area ? { NOT: here } : {}, FOUND - first.length) : [];
  return [...first, ...rest].map(assessed);
}

/** These hazards, where they are still on an assessment in use at the site. */
export async function hazardsByIds(siteId: string, ids: readonly string[]): Promise<AssessedHazard[]> {
  if (!ids.length) return [];
  const rows = await prisma.riskHazard.findMany({ where: { ...inUse(siteId), id: { in: [...ids] } }, include: withAssessment });
  return rows.map(assessed);
}
