import { clampRating, personsFrom, personsText, riskScore } from "@/modules/risk/shared/rules";
import { REVIEW_OUTCOMES, RISK_CATEGORIES, type RiskAction } from "@/modules/risk/shared/types";

/** Bringing the assessments over from the standalone Risk Management app (Nandui/project-risk),
 *  pure (tested in rules.test.ts): its rows in, the rows Turnfin keeps out, and what could not come
 *  across said in words. Sites and people are matched by the caller, which reads both databases;
 *  nothing here reads or writes. */

/** The old app's rows, by its own column names. Times are Dates read as UTC. */
export type OldRiskData = {
  centers: { id: string; name: string; siteCode: string | null }[];
  users: { id: string; name: string | null; email: string }[];
  areas: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  activities: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  assessments: {
    id: string; reference: string; description: string | null; centerId: string; subjectType: string; areaId: string | null; roleId: string | null; activityId: string | null;
    ownerId: string | null; departmentId: string | null; status: string; assessorName: string | null;
    /** The old CEO sign-off. */
    approvedByName: string | null; approvedById: string | null; approvedAt: Date | null;
    ownerApprovedByName: string | null; ownerApprovedById: string | null; ownerApprovedAt: Date | null;
    assessmentDate: Date; reviewFrequencyMonths: number; targetScore: number | null; lastReviewedDate: Date | null; nextReviewDate: Date; hazardSeq: number; createdAt: Date; updatedAt: Date;
  }[];
  hazards: {
    id: string; assessmentId: string; sortOrder: number; seq: number; hazard: string; riskFactor: string | null; personAtRisk: string | null; consequence: string | null;
    inherentLikelihood: number; inherentSeverity: number; currentControls: string | null; likelihood: number; severity: number; additionalControls: string | null; riskCategory: string;
    createdAt: Date; updatedAt: Date;
  }[];
  reviewLogs: { id: string; assessmentId: string; reviewedDate: Date; reviewerName: string | null; outcome: string; notes: string | null; nextReviewDate: Date; createdAt: Date }[];
  reviewRequests: { id: string; assessmentId: string; requestedById: string; notes: string; status: string; createdAt: Date; resolvedAt: Date | null; resolvedById: string | null; resolutionNote: string | null }[];
  auditLogs: { id: string; assessmentId: string | null; userId: string | null; userName: string | null; action: string; detail: string | null; createdAt: Date }[];
};

/** What the caller matched in Turnfin: each old centre's site, each old user's account (by email)
 *  and each old department's (by name). Anything missing is simply not there. */
export type ImportLookup = {
  sites: ReadonlyMap<string, { id: string; orgId: string; name: string }>;
  users: ReadonlyMap<string, { id: string; name: string }>;
  departments: ReadonlyMap<string, string>;
};

export type PlannedAssessment = {
  assessment: {
    id: string; orgId: string; siteId: string; reference: string; subjectType: string; subject: string; scope: string; departmentId: string | null; ownerId: string | null; ownerName: string;
    assessorName: string; status: string; archivedFrom: string; assessedOn: string; reviewMonths: number; targetScore: number; lastReviewedOn: string | null; nextReviewOn: string;
    ownerApprovedById: string | null; ownerApprovedByName: string | null; ownerApprovedAt: Date | null; execApprovedById: string | null; execApprovedByName: string | null; execApprovedAt: Date | null;
    hazardSeq: number; createdById: string; createdByName: string; createdAt: Date;
  };
  siteName: string;
  hazards: { id: string; seq: number; sortOrder: number; hazard: string; riskFactor: string; personsAtRisk: string; consequence: string; inherentLikelihood: number; inherentSeverity: number; controls: string; likelihood: number; severity: number; score: number; furtherAction: string; category: string; createdAt: Date }[];
  reviews: { id: string; reviewedOn: string; reviewerName: string; outcome: string; notes: string; nextReviewOn: string; createdAt: Date }[];
  requests: { id: string; requestedById: string | null; requestedByName: string; notes: string; status: string; resolvedAt: Date | null; resolvedById: string | null; resolvedByName: string | null; resolutionNote: string; createdAt: Date }[];
  events: { operationId: string; actorId: string | null; actorName: string; action: RiskAction; note: string; createdAt: Date }[];
};
export type ImportPlan = { assessments: PlannedAssessment[]; skipped: { reference: string; reason: string }[]; notes: string[] };

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const SUBJECT = { Area: "area", Role: "job", Activity: "activity" } as const;
const OUTCOME: Record<string, (typeof REVIEW_OUTCOMES)[number]> = { NoChanges: "no_changes", Updated: "updated", Escalated: "escalated" };
const REQUEST: Record<string, string> = { Open: "open", Actioned: "actioned", Dismissed: "dismissed" };
const HISTORY: Record<string, RiskAction> = {
  created: "create", imported: "create", updated: "edit", hazard_added: "hazard_add", hazard_updated: "hazard_edit", hazard_removed: "hazard_remove",
  approval_revoked: "signoff_reset", review_logged: "review", review_requested: "request",
};

/** The old app's history line as one of Turnfin's steps; null for one that has no place here. */
function historyAction(action: string, detail: string): RiskAction | null {
  if (action === "approved") return /^ceo\b/i.test(detail) ? "exec_approve" : "owner_approve";
  if (action === "review_request_resolved") return /dismissed/i.test(detail) ? "request_dismissed" : "request_actioned";
  return HISTORY[action] ?? null;
}

/** Where an old assessment stands in Turnfin. The old "Under review" also held approved ones
 *  whose review was overdue; here an overdue review is shown, not a change of status, so one with
 *  its owner's sign-off comes over in force. */
function standing(status: string, ownerSigned: boolean) {
  const live = status === "Draft" ? "draft" : ownerSigned ? "approved" : "review";
  return status === "Archived" ? { status: "archived", archivedFrom: live } : { status: live, archivedFrom: "" };
}

/** Every old assessment as Turnfin's rows. An assessment whose centre has no site here is skipped;
 *  a person with no account here keeps their name as text. Ids and references are kept, so running
 *  it again finds what is already there. */
export function planImport(old: OldRiskData, lookup: ImportLookup, operator: { id: string; name: string }): ImportPlan {
  const names = (rows: { id: string; name: string }[]) => new Map(rows.map((r) => [r.id, r.name]));
  const [areas, roles, activities] = [names(old.areas), names(old.roles), names(old.activities)];
  const oldUsers = new Map(old.users.map((u) => [u.id, u.name?.trim() || u.email]));
  const centers = new Map(old.centers.map((c) => [c.id, c]));
  const person = (id: string | null, fallback: string | null = null) => {
    const known = id ? lookup.users.get(id) : undefined;
    return { id: known?.id ?? null, name: known?.name ?? fallback ?? (id ? oldUsers.get(id) ?? "" : "") };
  };
  const plan: ImportPlan = { assessments: [], skipped: [], notes: [] };
  const unmatchedPeople = new Set<string>(), unmatchedDepartments = new Set<string>();
  const departmentNames = names(old.departments);

  for (const a of [...old.assessments].sort((x, y) => x.reference.localeCompare(y.reference))) {
    const site = lookup.sites.get(a.centerId);
    if (!site) { plan.skipped.push({ reference: a.reference, reason: `No site in Turnfin matches ${centers.get(a.centerId)?.name ?? "its centre"}.` }); continue; }
    const subjectType = SUBJECT[a.subjectType as keyof typeof SUBJECT] ?? "area";
    const subject = (subjectType === "area" ? areas.get(a.areaId ?? "") : subjectType === "job" ? roles.get(a.roleId ?? "") : activities.get(a.activityId ?? ""))?.trim();
    if (!subject) { plan.skipped.push({ reference: a.reference, reason: "It names no area, job or activity." }); continue; }
    const owner = person(a.ownerId);
    if (a.ownerId && !owner.id) unmatchedPeople.add(owner.name);
    const ownerSigned = !!a.ownerApprovedAt && !!a.ownerApprovedByName;
    const ownerSign = person(a.ownerApprovedById, a.ownerApprovedByName), execSign = person(a.approvedById, a.approvedByName);
    const departmentId = a.departmentId ? lookup.departments.get(a.departmentId) ?? null : null;
    if (a.departmentId && !departmentId) unmatchedDepartments.add(departmentNames.get(a.departmentId) ?? "A department");
    const hazards = old.hazards.filter((h) => h.assessmentId === a.id).sort((x, y) => x.sortOrder - y.sortOrder || x.seq - y.seq);

    plan.assessments.push({
      siteName: site.name,
      assessment: {
        id: a.id, orgId: site.orgId, siteId: site.id, reference: a.reference, subjectType, subject, scope: a.description?.trim() ?? "", departmentId,
        ownerId: owner.id, ownerName: owner.name, assessorName: a.assessorName?.trim() ?? "", ...standing(a.status, ownerSigned),
        assessedOn: dayOf(a.assessmentDate), reviewMonths: Math.min(60, Math.max(1, a.reviewFrequencyMonths)), targetScore: Math.min(25, Math.max(1, a.targetScore ?? 8)),
        lastReviewedOn: a.lastReviewedDate ? dayOf(a.lastReviewedDate) : null, nextReviewOn: dayOf(a.nextReviewDate),
        ownerApprovedById: ownerSigned ? ownerSign.id : null, ownerApprovedByName: ownerSigned ? ownerSign.name : null, ownerApprovedAt: ownerSigned ? a.ownerApprovedAt : null,
        // The executive sign-off sits on the owner's; one without the other does not come over.
        execApprovedById: ownerSigned && a.approvedAt ? execSign.id : null, execApprovedByName: ownerSigned && a.approvedAt ? execSign.name : null, execApprovedAt: ownerSigned ? a.approvedAt : null,
        hazardSeq: Math.max(a.hazardSeq, 0, ...hazards.map((h) => h.seq)), createdById: operator.id, createdByName: operator.name, createdAt: a.createdAt,
      },
      hazards: hazards.map((h, i) => {
        const [likelihood, severity] = [clampRating(h.likelihood), clampRating(h.severity)];
        const category = h.riskCategory.toLowerCase();
        return {
          id: h.id, seq: h.seq, sortOrder: i + 1, hazard: h.hazard.trim(), riskFactor: h.riskFactor?.trim() ?? "", personsAtRisk: personsText(personsFrom(h.personAtRisk)), consequence: h.consequence?.trim() ?? "",
          inherentLikelihood: clampRating(h.inherentLikelihood), inherentSeverity: clampRating(h.inherentSeverity), controls: h.currentControls?.trim() ?? "",
          likelihood, severity, score: riskScore(likelihood, severity), furtherAction: h.additionalControls?.trim() ?? "",
          category: (RISK_CATEGORIES as readonly string[]).includes(category) ? category : "physical", createdAt: h.createdAt,
        };
      }),
      reviews: old.reviewLogs.filter((r) => r.assessmentId === a.id).map((r) => ({
        id: r.id, reviewedOn: dayOf(r.reviewedDate), reviewerName: r.reviewerName?.trim() || "Not recorded", outcome: OUTCOME[r.outcome] ?? "no_changes", notes: r.notes?.trim() ?? "", nextReviewOn: dayOf(r.nextReviewDate), createdAt: r.createdAt,
      })),
      requests: old.reviewRequests.filter((r) => r.assessmentId === a.id).map((r) => {
        const asked = person(r.requestedById), answered = person(r.resolvedById);
        const status = REQUEST[r.status] ?? "open";
        return {
          id: r.id, requestedById: asked.id, requestedByName: asked.name || "Not recorded", notes: r.notes, status, createdAt: r.createdAt,
          resolvedAt: status === "open" ? null : r.resolvedAt, resolvedById: status === "open" ? null : answered.id, resolvedByName: status === "open" ? null : answered.name || null, resolutionNote: r.resolutionNote?.trim() ?? "",
        };
      }),
      events: [
        ...old.auditLogs.filter((e) => e.assessmentId === a.id).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()).flatMap((e) => {
          const action = historyAction(e.action, e.detail ?? "");
          return action ? [{ operationId: `old:${e.id}`, actorId: person(e.userId).id, actorName: e.userName?.trim() || person(e.userId).name || "Not recorded", action, note: e.detail?.trim() ?? "", createdAt: e.createdAt }] : [];
        }),
      ],
    });
  }
  if (unmatchedPeople.size) plan.notes.push(`No Turnfin account for: ${[...unmatchedPeople].sort().join(", ")}. Their names are kept; an owner without an account cannot sign off, so choose a new owner on those assessments.`);
  if (unmatchedDepartments.size) plan.notes.push(`No Turnfin department named: ${[...unmatchedDepartments].sort().join(", ")}. Those assessments come over with no department.`);
  return plan;
}
