import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonthsIso, afterContentChange, changedDetails, createSchema, daysBetween, hazardData, hazardReference, highestScore, isHighRisk, moveChange, nextReviewFor, overallScore,
  personsFrom, personsOf, personsText, referenceNumber, referencePrefix, reviewLine, reviewStateOf, riskBand, RiskError, riskReference, riskScore, siteCodeOf, addHazardSchema,
} from "./rules";
import { MOVES } from "./types";

/** The rules of Risk assessments, with invented assessments. */

test("risk is likelihood times severity, in four bands", () => {
  assert.equal(riskScore(4, 4), 16);
  assert.equal(riskScore(9, 0), 5, "ratings stay on the 1 to 5 scale");
  assert.deepEqual([1, 4, 5, 9, 10, 16, 17, 25].map(riskBand), ["low", "low", "medium", "medium", "high", "high", "very_high", "very_high"]);
  assert.equal(isHighRisk(9), false);
  assert.equal(isHighRisk(10), true);
  assert.equal(overallScore([]), null);
  assert.equal(overallScore([{ score: 4 }, { score: 9 }, { score: 16 }]), 10, "the rounded mean");
  assert.equal(highestScore([{ score: 4 }, { score: 16 }]), 16);
});

test("the next review is so many months on, at the month's end when the day does not exist", () => {
  assert.equal(addMonthsIso("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsIso("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsIso("2026-11-10", 12), "2027-11-10");
  assert.equal(addMonthsIso("2026-11-30", 3), "2027-02-28");
  assert.equal(nextReviewFor({ assessedOn: "2026-01-10", lastReviewedOn: null, reviewMonths: 6 }), "2026-07-10");
  assert.equal(nextReviewFor({ assessedOn: "2026-01-10", lastReviewedOn: "2026-08-01", reviewMonths: 6 }), "2027-02-01", "counted from the last review");
  assert.equal(daysBetween("2026-11-10", "2026-11-01"), -9);
});

test("only an assessment in force is on a review schedule", () => {
  const today = "2026-11-10";
  assert.deepEqual(reviewStateOf({ status: "approved", nextReviewOn: "2026-11-01" }, today), { state: "overdue", days: -9 });
  assert.equal(reviewStateOf({ status: "approved", nextReviewOn: today }, today).state, "due");
  assert.equal(reviewStateOf({ status: "approved", nextReviewOn: "2026-12-10" }, today).state, "due", "30 days ahead");
  assert.equal(reviewStateOf({ status: "approved", nextReviewOn: "2026-12-11" }, today).state, "ok");
  for (const status of ["draft", "review", "archived"]) assert.equal(reviewStateOf({ status, nextReviewOn: "2020-01-01" }, today).state, "none");
  assert.equal(reviewLine({ state: "overdue", days: -1 }), "Overdue by 1 day");
  assert.equal(reviewLine({ state: "due", days: 0 }), "Due today");
  assert.equal(reviewLine({ state: "ok", days: 45 }), "Due in 45 days");
});

test("references carry the site's code, and a hazard's number hangs off its assessment's", () => {
  assert.equal(siteCodeOf({ name: "Bishopstown", code: "bt" }), "BT");
  assert.equal(siteCodeOf({ name: "Churchfield", code: null }), "CH");
  assert.equal(riskReference("BT", 7), "RA-BT-0007");
  assert.equal(referenceNumber("RA-BT-0041", referencePrefix("BT")), 41);
  assert.equal(referenceNumber("RA-CH-0041", referencePrefix("BT")), 0);
  assert.equal(referenceNumber("RA-BT-old", referencePrefix("BT")), 0);
  assert.equal(hazardReference("RA-BT-0001", 3), "RA-BT-0001-HZ-003");
});

test("free text about who is at risk becomes the standard names", () => {
  assert.deepEqual(personsFrom("Members of the public, staff"), ["Staff", "Visitors"], "the public are visitors, not customers");
  assert.deepEqual(personsFrom("Swimmers and children in lessons; lifeguards"), ["Staff", "Customers", "Children"]);
  assert.deepEqual(personsFrom(null), []);
  assert.equal(personsText(["Visitors", "Staff"]), "Staff, Visitors");
  assert.deepEqual(personsOf("Staff, Visitors"), ["Staff", "Visitors"]);
  assert.deepEqual(personsOf(""), []);
});

test("a hazard keeps its score beside its ratings, and must name who it could harm", () => {
  const fields = { hazard: "Wet floor at the pool edge", riskFactor: "", personsAtRisk: ["Customers" as const, "Staff" as const], consequence: "", inherentLikelihood: 4, inherentSeverity: 3, controls: "Matting", likelihood: 2, severity: 3, furtherAction: "", category: "physical" as const };
  assert.deepEqual(hazardData(fields), { ...fields, personsAtRisk: "Staff, Customers", score: 6 });
  const on = { assessmentId: "a", operationId: crypto.randomUUID(), version: 1, hazardId: crypto.randomUUID() };
  assert.equal(addHazardSchema.safeParse({ ...on, ...fields }).success, true);
  assert.equal(addHazardSchema.safeParse({ ...on, ...fields, personsAtRisk: [] }).success, false);
  assert.equal(addHazardSchema.safeParse({ ...on, ...fields, severity: 6 }).success, false);
});

test("a new draft needs a real day and a target on the scale", () => {
  const draft = { id: crypto.randomUUID(), operationId: crypto.randomUUID(), siteId: "s", subjectType: "area" as const, subject: "Main pool", assessedOn: "2026-11-01", reviewMonths: 12, targetScore: 8 };
  assert.equal(createSchema.safeParse(draft).success, true);
  assert.equal(createSchema.safeParse({ ...draft, assessedOn: "2026-02-30" }).success, false);
  assert.equal(createSchema.safeParse({ ...draft, targetScore: 26 }).success, false);
  assert.equal(createSchema.safeParse({ ...draft, subject: "" }).success, false);
});

const when = new Date("2026-11-10T10:00:00Z");
const signedOff = { ownerApprovedAt: when, execApprovedAt: null };
const unsigned = { ownerApprovedAt: null, execApprovedAt: null };

test("changing what was signed off clears the sign-off and waits for it again", () => {
  assert.deepEqual(afterContentChange({ status: "draft", ...unsigned }), { data: {}, cleared: false });
  assert.deepEqual(afterContentChange({ status: "review", ...unsigned }), { data: {}, cleared: false });
  const reset = afterContentChange({ status: "approved", ...signedOff, execApprovedAt: when });
  assert.equal(reset.cleared, true);
  assert.equal(reset.data.status, "review");
  assert.equal(reset.data.ownerApprovedAt, null);
  assert.equal(reset.data.execApprovedAt, null);
  assert.throws(() => afterContentChange({ status: "archived", ...unsigned }), RiskError);
});

test("each move is allowed only from where the assessment stands, and only by the right person", () => {
  const owner = { id: "orla", name: "Orla" }, other = { id: "sam", name: "Sam" };
  const row = { archivedFrom: "", ownerId: "orla", ownerName: "Orla", hazards: 2, ...unsigned };
  const move = (r: Parameters<typeof moveChange>[0], m: (typeof MOVES)[number], who = owner, note = "") => moveChange(r, m, note, who, when);

  assert.deepEqual(move({ ...row, status: "draft" }, "submit", other), { status: "review" });
  assert.throws(() => move({ ...row, status: "draft", ownerId: null }, "submit"), /owns/);
  assert.throws(() => move({ ...row, status: "draft", hazards: 0 }, "submit"), /hazard/);
  assert.throws(() => move({ ...row, status: "review" }, "submit"), RiskError);

  assert.deepEqual(move({ ...row, status: "review" }, "owner_approve"), { status: "approved", ownerApprovedById: "orla", ownerApprovedByName: "Orla", ownerApprovedAt: when });
  assert.throws(() => move({ ...row, status: "review" }, "owner_approve", other), /Only its owner, Orla,/);
  assert.throws(() => move({ ...row, status: "draft" }, "owner_approve"), RiskError);

  const inForce = { ...row, status: "approved", ...signedOff };
  assert.deepEqual(move(inForce, "exec_approve", other), { execApprovedById: "sam", execApprovedByName: "Sam", execApprovedAt: when });
  assert.throws(() => move(inForce, "exec_approve", owner), /other than the owner/);
  assert.throws(() => move({ ...inForce, execApprovedAt: when }, "exec_approve", other), /already/);
  assert.throws(() => move({ ...row, status: "review" }, "exec_approve", other), /not in force/);

  assert.throws(() => move(inForce, "owner_withdraw"), /why/);
  const withdrawn = move({ ...inForce, execApprovedAt: when }, "owner_withdraw", owner, "Pool hall refitted");
  assert.equal(withdrawn.status, "review");
  assert.equal("execApprovedAt" in withdrawn && withdrawn.execApprovedAt, null, "the executive sign-off goes with it");
  assert.throws(() => move(inForce, "owner_withdraw", other, "Not mine"), /Only its owner/);
  assert.throws(() => move(inForce, "exec_withdraw", other, "No sign-off there"), /no executive sign-off/);
  assert.deepEqual(move({ ...inForce, execApprovedAt: when }, "exec_withdraw", other, "Signed in error"), { execApprovedById: null, execApprovedByName: null, execApprovedAt: null });

  assert.deepEqual(move(inForce, "archive", other), { status: "archived", archivedFrom: "approved" });
  assert.throws(() => move({ ...row, status: "archived" }, "archive"), RiskError);
  assert.deepEqual(move({ ...inForce, status: "archived", archivedFrom: "approved" }, "restore", other), { status: "approved", archivedFrom: "" });
  assert.deepEqual(move({ ...row, status: "archived", archivedFrom: "approved" }, "restore", other), { status: "review", archivedFrom: "" }, "in force only with its sign-off");
  assert.deepEqual(move({ ...row, status: "archived", archivedFrom: "" }, "restore", other), { status: "draft", archivedFrom: "" });
  assert.throws(() => move(inForce, "restore"), RiskError);
});

test("an edit's history names what changed", () => {
  const old = { subjectType: "area" as const, subject: "Main pool", scope: "", departmentId: "", ownerId: "orla", assessorName: "", assessedOn: "2026-01-10", reviewMonths: 12, targetScore: 8 };
  assert.deepEqual(changedDetails(old, old), []);
  assert.deepEqual(changedDetails(old, { ...old, subjectType: "activity", subject: "Lane swimming", ownerId: "sam", targetScore: 6 }), ["what it is about", "owner", "target risk"]);
});
