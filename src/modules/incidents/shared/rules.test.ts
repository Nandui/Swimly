import assert from "node:assert/strict";
import test from "node:test";
import { addWorkingDays, closeDecision, isSerious, IncidentError, needsSignoff, reportProblem, reportSchema, triageDecision, triageSchema } from "./rules";

const who = { id: "dan", name: "Dan", orgId: null, superadmin: false, review: true, signoff: false };
const row = { status: "reported", reporterId: "mia", occurredOn: "2026-10-09", serious: false, severityActual: null, severityPotential: null, hsaReportable: null, hasChild: false };
const triage = (over: object = {}) => triageSchema.parse({ severityActual: 1, severityPotential: 2, staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, parentInformed: "", outcome: "close", note: "Wet floor sign was back out.", ...over });
const report = (over: object = {}) => reportSchema.parse({ siteId: "s", area: "", kind: "near_miss", category: "slip_trip_fall", occurredOn: "2026-10-10", occurredAt: "14:30", description: "Puddle by the slide steps, no sign.", immediateAction: "", raisedBy: "", people: [], witnesses: [], ...over });
const person = { type: "swimmer", ageGroup: "child", name: "", contact: "", injured: true, bodyPart: "", injury: "", firstAid: "", firstAidBy: "", ambulance: false, hospital: false };

test("the HSA deadline is 10 working days, skipping weekends", () => {
  assert.equal(addWorkingDays("2026-10-09", 10), "2026-10-23", "Friday to the Friday two weeks on");
  assert.equal(addWorkingDays("2026-10-10", 1), "2026-10-12", "Saturday to Monday");
});

test("a report: an accident needs someone hurt, and nothing in the future", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  assert.equal(reportProblem(report(), now), null);
  assert.match(reportProblem(report({ kind: "accident" }), now)!, /someone was hurt/);
  assert.equal(reportProblem(report({ kind: "accident", people: [person] }), now), null);
  assert.match(reportProblem(report({ occurredOn: "2026-10-12" }), now)!, /future/);
});

test("serious: an ambulance, hospital or a category that always is", () => {
  assert.equal(isSerious(report()), false);
  assert.equal(isSerious(report({ people: [{ ...person, hospital: true }] })), true);
  assert.equal(isSerious(report({ category: "water_rescue" })), true);
});

test("triage closes only minimal or minor reports the HSA does not need, and never your own", () => {
  assert.equal(triageDecision(row, who, triage()).status, "closed");
  assert.throws(() => triageDecision(row, who, triage({ severityPotential: 3 })), IncidentError, "the potential counts");
  assert.throws(() => triageDecision(row, who, triage({ publicToDoctor: true })), IncidentError);
  assert.throws(() => triageDecision(row, { ...who, id: "mia" }, triage()), IncidentError);
  assert.throws(() => triageDecision({ ...row, hasChild: true }, who, triage()), IncidentError, "a child's parent must have been told");
  const reportable = triageDecision(row, who, triage({ outcome: "investigate", staffOffOver3Days: true, severityActual: 4 }));
  assert.deepEqual([reportable.status, reportable.hsaReportable, reportable.hsaDueOn], ["investigating", true, "2026-10-23"]);
  assert.throws(() => triageDecision({ ...row, status: "investigating" }, who, triage()), IncidentError, "once");
});

test("closing: a manager for serious or moderate, and the HSA reference first", () => {
  const open = { ...row, status: "investigating", severityActual: 3, severityPotential: 3, hsaReportable: true };
  const close = { note: "Step edge replaced and checked.", hsaReference: "" };
  assert.equal(needsSignoff(open), true);
  assert.throws(() => closeDecision(open, who, close), /manager/);
  assert.throws(() => closeDecision(open, { ...who, signoff: true }, close), /HSA/);
  assert.equal(closeDecision(open, { ...who, signoff: true }, { ...close, hsaReference: "IR1 12345" }).status, "closed");
  assert.equal(closeDecision({ ...open, severityActual: 1, severityPotential: 2, hsaReportable: false }, who, close).status, "closed");
});
