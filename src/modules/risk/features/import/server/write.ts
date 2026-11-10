import type { PrismaClient } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import type { ImportPlan } from "@/modules/risk/features/import/rules";
import { RISK_ACTIONS } from "@/modules/risk/shared/types";

/** Writes an import plan (rules.ts), for the operator script scripts/import-risk-assessments.ts.
 *  A dry run unless `confirm`: it then only says what would happen. Each assessment lands whole in
 *  its own transaction (its hazards, reviews, requests and old history, one "brought over" step and
 *  one audit row), or not at all. One already here, by id or by reference, is left as it is, so the
 *  script can be run again; so is one whose area, job or activity already has a live assessment at
 *  the site. No `server-only`: a script runs it, never a page. */
export type ImportLine = { reference: string; subject: string; site: string; hazards: number; outcome: "imported" | "would import" | "already here" | "skipped"; reason?: string };

export async function writeImport(db: PrismaClient, plan: ImportPlan, operator: { id: string; name: string }, options: { confirm: boolean }): Promise<ImportLine[]> {
  const lines: ImportLine[] = plan.skipped.map((s) => ({ reference: s.reference, subject: "", site: "", hazards: 0, outcome: "skipped", reason: s.reason }));
  for (const planned of plan.assessments) {
    const a = planned.assessment;
    const line = { reference: a.reference, subject: a.subject, site: planned.siteName, hazards: planned.hazards.length };
    const here = await db.riskAssessment.findFirst({ where: { OR: [{ id: a.id }, { orgId: a.orgId, reference: a.reference }] }, select: { id: true } });
    if (here) { lines.push({ ...line, outcome: "already here" }); continue; }
    const clash = a.status === "archived" ? null : await db.riskAssessment.findFirst({
      where: { orgId: a.orgId, siteId: a.siteId, subjectType: a.subjectType, subject: { equals: a.subject, mode: "insensitive" }, status: { not: "archived" } }, select: { reference: true },
    });
    if (clash) { lines.push({ ...line, outcome: "skipped", reason: `${clash.reference} already covers this at the site.` }); continue; }
    if (!options.confirm) { lines.push({ ...line, outcome: "would import" }); continue; }
    await db.$transaction(async (tx) => {
      await tx.riskAssessment.create({ data: a });
      const on = { orgId: a.orgId, assessmentId: a.id };
      if (planned.hazards.length) await tx.riskHazard.createMany({ data: planned.hazards.map((h) => ({ ...on, ...h })) });
      if (planned.reviews.length) await tx.riskReview.createMany({ data: planned.reviews.map((r) => ({ ...on, ...r })) });
      if (planned.requests.length) await tx.riskReviewRequest.createMany({ data: planned.requests.map((r) => ({ ...on, siteId: a.siteId, ...r })) });
      await tx.riskEvent.createMany({ data: [
        ...planned.events.map((e) => ({ ...on, ...e })),
        { ...on, operationId: `import:${a.id}`, actorId: operator.id, actorName: operator.name, action: "import", note: "" },
      ] });
      await logAudit({
        actorId: operator.id, actorName: operator.name, entity: "RiskAssessment", entityId: a.id, clubId: a.siteId, action: "import",
        summary: `${a.reference} ${a.subject}. ${RISK_ACTIONS.import}, with ${planned.hazards.length} ${planned.hazards.length === 1 ? "hazard" : "hazards"}.`,
      }, tx);
    });
    lines.push({ ...line, outcome: "imported" });
  }
  return lines;
}
