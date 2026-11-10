import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { planImport, type ImportLookup, type OldRiskData } from "./rules";

/** Bringing assessments over from the old Risk Management app, with invented centres, people and
 *  hazards: what each old row becomes, what is skipped and why, and that the write is a dry run
 *  until confirmed, lands each assessment whole and can be run again. */
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const old: OldRiskData = {
  centers: [{ id: "c-bt", name: "Bishopstown", siteCode: "BT" }, { id: "c-zz", name: "Closed Centre", siteCode: "ZZ" }],
  users: [{ id: "u-orla", name: "Orla Example", email: "orla@example.invalid" }, { id: "u-gone", name: "Gary Gone", email: "gary@example.invalid" }, { id: "u-ed", name: "Ed Example", email: "ed@example.invalid" }],
  areas: [{ id: "ar-pool", name: "Main Pool" }, { id: "ar-gym", name: "Gym" }, { id: "ar-cafe", name: "Café" }],
  roles: [{ id: "ro-life", name: "Lifeguard" }],
  activities: [{ id: "ac-chem", name: "Handling pool chemicals" }],
  departments: [{ id: "d-ops", name: "Operations" }, { id: "d-old", name: "Leisure Services" }],
  assessments: [
    { id: "a-pool", reference: "RA-BT-0001", description: " Public swimming ", centerId: "c-bt", subjectType: "Area", areaId: "ar-pool", roleId: null, activityId: null, ownerId: "u-orla", departmentId: "d-ops",
      status: "UnderReview", assessorName: "Pat Assessor", approvedByName: "Ed Example", approvedById: "u-ed", approvedAt: at("2026-02-02"), ownerApprovedByName: "Orla Example", ownerApprovedById: "u-orla", ownerApprovedAt: at("2026-02-01"),
      assessmentDate: at("2026-01-10"), reviewFrequencyMonths: 12, targetScore: 8, lastReviewedDate: at("2026-06-01"), nextReviewDate: at("2027-06-01"), hazardSeq: 3, createdAt: at("2026-01-10"), updatedAt: at("2026-06-01") },
    { id: "a-life", reference: "RA-BT-0002", description: null, centerId: "c-bt", subjectType: "Role", areaId: null, roleId: "ro-life", activityId: null, ownerId: "u-gone", departmentId: "d-old",
      status: "Draft", assessorName: null, approvedByName: "Ed Example", approvedById: "u-ed", approvedAt: at("2026-03-01"), ownerApprovedByName: null, ownerApprovedById: null, ownerApprovedAt: null,
      assessmentDate: at("2026-03-01"), reviewFrequencyMonths: 6, targetScore: null, lastReviewedDate: null, nextReviewDate: at("2026-09-01"), hazardSeq: 0, createdAt: at("2026-03-01"), updatedAt: at("2026-03-01") },
    { id: "a-chem", reference: "RA-BT-0003", description: null, centerId: "c-bt", subjectType: "Activity", areaId: null, roleId: null, activityId: "ac-chem", ownerId: null, departmentId: null,
      status: "Archived", assessorName: null, approvedByName: null, approvedById: null, approvedAt: null, ownerApprovedByName: "Gary Gone", ownerApprovedById: "u-gone", ownerApprovedAt: at("2025-05-01"),
      assessmentDate: at("2025-04-01"), reviewFrequencyMonths: 12, targetScore: 6, lastReviewedDate: null, nextReviewDate: at("2026-04-01"), hazardSeq: 1, createdAt: at("2025-04-01"), updatedAt: at("2025-05-01") },
    { id: "a-zz", reference: "RA-ZZ-0001", description: null, centerId: "c-zz", subjectType: "Area", areaId: "ar-gym", roleId: null, activityId: null, ownerId: null, departmentId: null,
      status: "Draft", assessorName: null, approvedByName: null, approvedById: null, approvedAt: null, ownerApprovedByName: null, ownerApprovedById: null, ownerApprovedAt: null,
      assessmentDate: at("2026-01-01"), reviewFrequencyMonths: 12, targetScore: 8, lastReviewedDate: null, nextReviewDate: at("2027-01-01"), hazardSeq: 0, createdAt: at("2026-01-01"), updatedAt: at("2026-01-01") },
    { id: "a-none", reference: "RA-BT-0004", description: null, centerId: "c-bt", subjectType: "Area", areaId: null, roleId: null, activityId: null, ownerId: null, departmentId: null,
      status: "Draft", assessorName: null, approvedByName: null, approvedById: null, approvedAt: null, ownerApprovedByName: null, ownerApprovedById: null, ownerApprovedAt: null,
      assessmentDate: at("2026-01-01"), reviewFrequencyMonths: 12, targetScore: 8, lastReviewedDate: null, nextReviewDate: at("2027-01-01"), hazardSeq: 0, createdAt: at("2026-01-01"), updatedAt: at("2026-01-01") },
  ],
  hazards: [
    { id: "h-2", assessmentId: "a-pool", sortOrder: 1, seq: 3, hazard: "Chlorine gas", riskFactor: null, personAtRisk: "Maintenance staff", consequence: null, inherentLikelihood: 3, inherentSeverity: 5, currentControls: "Gas alarm",
      likelihood: 2, severity: 5, additionalControls: "Second alarm", riskCategory: "Chemical", createdAt: at("2026-01-10"), updatedAt: at("2026-01-10") },
    { id: "h-1", assessmentId: "a-pool", sortOrder: 0, seq: 1, hazard: " Wet floor ", riskFactor: "Splashing", personAtRisk: "Members of the public, staff", consequence: "A fall", inherentLikelihood: 4, inherentSeverity: 3, currentControls: null,
      likelihood: 2, severity: 3, additionalControls: null, riskCategory: "Slippery", createdAt: at("2026-01-10"), updatedAt: at("2026-01-10") },
    { id: "h-3", assessmentId: "a-chem", sortOrder: 0, seq: 1, hazard: "Splash to the eyes", riskFactor: null, personAtRisk: null, consequence: null, inherentLikelihood: 9, inherentSeverity: 0, currentControls: "Goggles",
      likelihood: 1, severity: 4, additionalControls: null, riskCategory: "Chemical", createdAt: at("2025-04-01"), updatedAt: at("2025-04-01") },
  ],
  reviewLogs: [{ id: "rv-1", assessmentId: "a-pool", reviewedDate: at("2026-06-01"), reviewerName: null, outcome: "Updated", notes: " Signs replaced ", nextReviewDate: at("2027-06-01"), createdAt: at("2026-06-01") }],
  reviewRequests: [
    { id: "rq-1", assessmentId: "a-pool", requestedById: "u-gone", notes: "Matting worn", status: "Actioned", createdAt: at("2026-05-01"), resolvedAt: at("2026-05-03"), resolvedById: "u-orla", resolutionNote: "Replaced" },
    { id: "rq-2", assessmentId: "a-pool", requestedById: "u-orla", notes: "New slide", status: "Open", createdAt: at("2026-07-01"), resolvedAt: null, resolvedById: null, resolutionNote: null },
  ],
  auditLogs: [
    { id: "e-3", assessmentId: "a-pool", userId: "u-ed", userName: "Ed Example", action: "approved", detail: "CEO approval by Ed Example", createdAt: at("2026-02-02") },
    { id: "e-1", assessmentId: "a-pool", userId: "u-orla", userName: "Orla Example", action: "created", detail: null, createdAt: at("2026-01-10") },
    { id: "e-2", assessmentId: "a-pool", userId: "u-orla", userName: "Orla Example", action: "approved", detail: "Owner approval by Orla Example · status → Approved", createdAt: at("2026-02-01") },
    { id: "e-4", assessmentId: "a-pool", userId: "u-orla", userName: null, action: "review_request_resolved", detail: "Request dismissed — duplicate", createdAt: at("2026-05-03") },
    { id: "e-5", assessmentId: "a-pool", userId: null, userName: null, action: "deleted", detail: "gone", createdAt: at("2026-05-04") },
  ],
};
const lookup: ImportLookup = {
  sites: new Map([["c-bt", { id: "site-bt", orgId: "org-1", name: "Bishopstown" }]]),
  users: new Map([["u-orla", { id: "orla", name: "Orla Example" }], ["u-ed", { id: "ed", name: "Ed Example" }]]),
  departments: new Map([["d-ops", "dep-ops"]]),
};
const operator = { id: "orla", name: "Orla Example" };

test("each old assessment becomes Turnfin's rows, keeping its reference and ids", () => {
  const plan = planImport(old, lookup, operator);
  assert.deepEqual(plan.assessments.map((p) => p.assessment.reference), ["RA-BT-0001", "RA-BT-0002", "RA-BT-0003"]);
  const pool = plan.assessments[0];
  assert.deepEqual(
    { ...pool.assessment, ownerApprovedAt: pool.assessment.ownerApprovedAt?.toISOString(), execApprovedAt: pool.assessment.execApprovedAt?.toISOString(), createdAt: pool.assessment.createdAt.toISOString() },
    {
      id: "a-pool", orgId: "org-1", siteId: "site-bt", reference: "RA-BT-0001", subjectType: "area", subject: "Main Pool", scope: "Public swimming", departmentId: "dep-ops", ownerId: "orla", ownerName: "Orla Example",
      assessorName: "Pat Assessor", status: "approved", archivedFrom: "", assessedOn: "2026-01-10", reviewMonths: 12, targetScore: 8, lastReviewedOn: "2026-06-01", nextReviewOn: "2027-06-01",
      ownerApprovedById: "orla", ownerApprovedByName: "Orla Example", ownerApprovedAt: "2026-02-01T00:00:00.000Z", execApprovedById: "ed", execApprovedByName: "Ed Example", execApprovedAt: "2026-02-02T00:00:00.000Z",
      hazardSeq: 3, createdById: "orla", createdByName: "Orla Example", createdAt: "2026-01-10T00:00:00.000Z",
    }, "signed off by its owner, so in force: an overdue review is shown, not a status");
  assert.deepEqual(pool.hazards.map((h) => [h.id, h.seq, h.sortOrder, h.hazard, h.personsAtRisk, h.category, h.score]), [
    ["h-1", 1, 1, "Wet floor", "Staff, Visitors", "physical", 6], ["h-2", 3, 2, "Chlorine gas", "Staff", "chemical", 10],
  ], "in their order, numbers kept, an unknown kind as physical");
  assert.deepEqual(pool.reviews.map((r) => [r.reviewedOn, r.reviewerName, r.outcome, r.notes]), [["2026-06-01", "Not recorded", "updated", "Signs replaced"]]);
  assert.deepEqual(pool.requests.map((r) => [r.status, r.requestedById, r.requestedByName, r.resolvedByName, r.resolutionNote]), [
    ["actioned", null, "Gary Gone", "Orla Example", "Replaced"], ["open", "orla", "Orla Example", null, ""],
  ]);
  assert.deepEqual(pool.events.map((e) => [e.operationId, e.action, e.actorName]), [
    ["old:e-1", "create", "Orla Example"], ["old:e-2", "owner_approve", "Orla Example"], ["old:e-3", "exec_approve", "Ed Example"], ["old:e-4", "request_dismissed", "Orla Example"],
  ], "in time order; a deletion has no place here");
});

test("a draft stays a draft, an archived one remembers where it stood, and what cannot come over is said", () => {
  const plan = planImport(old, lookup, operator);
  const [, life, chem] = plan.assessments;
  assert.deepEqual([life.assessment.status, life.assessment.subjectType, life.assessment.subject, life.assessment.ownerId, life.assessment.ownerName, life.assessment.departmentId, life.assessment.targetScore],
    ["draft", "job", "Lifeguard", null, "Gary Gone", null, 8]);
  assert.deepEqual([life.assessment.execApprovedByName, life.assessment.execApprovedAt], [null, null], "an executive sign-off without the owner's does not come over");
  assert.deepEqual([chem.assessment.status, chem.assessment.archivedFrom, chem.assessment.subjectType, chem.assessment.ownerApprovedById, chem.assessment.ownerApprovedByName], ["archived", "approved", "activity", null, "Gary Gone"]);
  assert.deepEqual([chem.hazards[0].inherentLikelihood, chem.hazards[0].inherentSeverity, chem.hazards[0].personsAtRisk], [5, 1, ""], "ratings kept on the scale");
  assert.deepEqual(plan.skipped, [
    { reference: "RA-BT-0004", reason: "It names no area, job or activity." },
    { reference: "RA-ZZ-0001", reason: "No site in Turnfin matches Closed Centre." },
  ]);
  assert.equal(plan.notes.length, 2);
  assert.match(plan.notes[0], /No Turnfin account for: Gary Gone\./);
  assert.match(plan.notes[1], /No Turnfin department named: Leisure Services\./);
});

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let writer: typeof import("./server/write");
let site = "";
/** The same matches, against rows that exist: the audit log names a real person and site. */
let real: ImportLookup;
before(async () => {
  fixture = await isolatedPrisma();
  const club = await fixture.prisma.club.findFirstOrThrow({ where: { name: { contains: "Bishopstown" } } });
  site = club.id;
  await fixture.prisma.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["orla", "ed"]) await fixture.prisma.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: club.orgId } });
  real = { ...lookup, sites: new Map([["c-bt", { id: site, orgId: club.orgId ?? "org-1", name: club.name }]]), departments: new Map() };
  writer = serverModule("src/modules/risk/features/import/server/write.ts", {
    "@/lib/prisma": { prisma: fixture.prisma }, "@/lib/clubs/current": { currentClubIdIfAny: async () => null }, "server-only": {},
  });
});
after(async () => { await fixture?.close(); });

test("the write is a dry run until confirmed, lands each assessment whole, and can be run again", async () => {
  const db = fixture.prisma;
  const plan = planImport(old, real, operator);
  const dry = await writer.writeImport(db, plan, operator, { confirm: false });
  assert.deepEqual(dry.map((l) => l.outcome), ["skipped", "skipped", "would import", "would import", "would import"]);
  assert.equal(await db.riskAssessment.count(), 0, "nothing written");

  const done = await writer.writeImport(db, plan, operator, { confirm: true });
  assert.deepEqual(done.filter((l) => l.outcome === "imported").map((l) => [l.reference, l.hazards]), [["RA-BT-0001", 2], ["RA-BT-0002", 0], ["RA-BT-0003", 1]]);
  assert.deepEqual([await db.riskAssessment.count(), await db.riskHazard.count(), await db.riskReview.count(), await db.riskReviewRequest.count()], [3, 3, 1, 2]);
  const history = await db.riskEvent.findMany({ where: { assessmentId: "a-pool" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(history.map((e) => e.action), ["create", "owner_approve", "exec_approve", "request_dismissed", "import"], "the old history, then the step that brought it over");
  assert.equal(history[0].createdAt.toISOString(), "2026-01-10T00:00:00.000Z", "with its own dates");
  const audit = await db.auditLog.findMany({ where: { entity: "RiskAssessment" } });
  assert.deepEqual([audit.length, audit[0].action, audit[0].module, audit[0].clubId], [3, "import", "Risk assessments", site], "one audit row for each assessment brought over");
  assert.equal((await db.riskReviewRequest.findUniqueOrThrow({ where: { id: "rq-2" } })).siteId, site);

  const again = await writer.writeImport(db, plan, operator, { confirm: true });
  assert.deepEqual(again.filter((l) => l.outcome !== "skipped").map((l) => l.outcome), ["already here", "already here", "already here"]);
  assert.equal(await db.riskAssessment.count(), 3);
});

test("an area that already has a live assessment at the site is left alone", async () => {
  const db = fixture.prisma;
  const other = structuredClone(old);
  other.assessments = [{ ...old.assessments[0], id: "a-pool-2", reference: "RA-BT-0009", areaId: "ar-pool" }];
  other.hazards = []; other.reviewLogs = []; other.reviewRequests = []; other.auditLogs = [];
  const lines = await writer.writeImport(db, planImport(other, real, operator), operator, { confirm: true });
  assert.deepEqual(lines.map((l) => [l.outcome, l.reason]), [["skipped", "RA-BT-0001 already covers this at the site."]]);
});
