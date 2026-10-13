import assert from "node:assert/strict";
import test from "node:test";
import { actionProblem, actionSchema, addWorkingDays, keepUntil, monthsEnding, summarise, cleanWhys, closeDecision, fileProblem, isSerious, IncidentError, needsSignoff, reopenDecision, reportProblem, reportSchema, statementProblem, statementSchema, triageDecision, triageSchema } from "./rules";
import { actionStatus } from "./types";

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

test("triage closes only minimal or minor reports the HSA does not need, and your own only with Manage", () => {
  assert.equal(triageDecision(row, who, triage()).status, "closed");
  assert.throws(() => triageDecision(row, who, triage({ severityPotential: 3 })), IncidentError, "the potential counts");
  assert.throws(() => triageDecision(row, who, triage({ publicToDoctor: true })), IncidentError);
  assert.throws(() => triageDecision(row, { ...who, id: "mia" }, triage()), IncidentError);
  assert.equal(triageDecision(row, { ...who, id: "mia", signoff: true }, triage()).status, "closed", "Manage triages their own");
  assert.throws(() => triageDecision({ ...row, hasChild: true }, who, triage()), IncidentError, "a child's parent must have been told");
  const reportable = triageDecision(row, who, triage({ outcome: "investigate", staffOffOver3Days: true, severityActual: 4 }));
  assert.deepEqual([reportable.status, reportable.hsaReportable, reportable.hsaDueOn], ["investigating", true, "2026-10-23"]);
  const fatal = triageDecision(row, who, triage({ outcome: "investigate", fatal: true, severityActual: 5 }));
  assert.deepEqual([fatal.hsaReportable, fatal.hsaFatal, fatal.hsaDueOn], [true, true, "2026-10-16"], "a death: 5 working days");
  assert.throws(() => triageDecision({ ...row, status: "investigating" }, who, triage()), IncidentError, "once");
});

test("closing: a manager for serious or moderate, and the HSA reference first", () => {
  const open = { ...row, status: "investigating", severityActual: 3, severityPotential: 3, hsaReportable: true, rootCause: "No one owns the step check." };
  const close = { note: "Step edge replaced and checked.", hsaReference: "" };
  assert.equal(needsSignoff(open), true);
  assert.throws(() => closeDecision(open, who, close, 0), /manager/);
  assert.throws(() => closeDecision(open, { ...who, signoff: true }, close, 0), /HSA/);
  assert.equal(closeDecision(open, { ...who, signoff: true }, { ...close, hsaReference: "IR1 12345" }, 0).status, "closed");
  assert.equal(closeDecision({ ...open, severityActual: 1, severityPotential: 2, hsaReportable: false, rootCause: "" }, who, close, 0).status, "closed", "minor: no root cause needed");
});

test("closing an investigation: no action left open, and a root cause from moderate up", () => {
  const open = { ...row, status: "investigating", severityActual: 3, severityPotential: 3, hsaReportable: false, rootCause: "" };
  const manager = { ...who, signoff: true }, close = { note: "Step edge replaced and checked.", hsaReference: "" };
  assert.throws(() => closeDecision(open, manager, close, 0), /root cause/);
  assert.throws(() => closeDecision({ ...open, rootCause: "No one owns the step check." }, manager, close, 2), /2 actions are still open/);
  assert.equal(closeDecision({ ...open, rootCause: "No one owns the step check." }, manager, close, 0).status, "closed");
});

test("statements, whys and actions", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const st = statementSchema.parse({ givenBy: "Aoife", givenAs: "lifeguard", takenOn: "2026-10-10", text: "I saw the boy slip on the second step." });
  assert.equal(statementProblem(st, "2026-10-09", now), null);
  assert.match(statementProblem({ ...st, takenOn: "2026-10-08" }, "2026-10-09", now)!, /before it happened/);
  assert.match(statementProblem({ ...st, takenOn: "2026-10-12" }, "2026-10-09", now)!, /future/);
  assert.deepEqual(cleanWhys(["Wet step", "", "No sign", "", ""]), ["Wet step", "No sign"]);
  const action = actionSchema.parse({ title: "Add the steps to the hourly check", ownerId: "sam", dueOn: "2026-10-11" });
  assert.equal(actionProblem(action, now), null, "due today is fine");
  assert.match(actionProblem({ ...action, dueOn: "2026-10-10" }, now)!, /passed/);
  assert.equal(actionStatus({ status: "open", dueOn: "2026-10-10" }, "2026-10-11"), "overdue");
  assert.equal(actionStatus({ status: "open", dueOn: "2026-10-11" }, "2026-10-11"), "open");
  assert.equal(actionStatus({ status: "done", dueOn: "2026-10-01" }, "2026-10-11"), "done");
});

test("reopening: a manager, a closed report, never your own", () => {
  const closed = { status: "closed", reporterId: "mia" };
  assert.equal(reopenDecision(closed, { id: "dan", signoff: true }).status, "investigating");
  assert.throws(() => reopenDecision(closed, { id: "dan", signoff: false }), /manager/);
  assert.throws(() => reopenDecision(closed, { id: "mia", signoff: true }), /your own/);
  assert.throws(() => reopenDecision({ ...closed, status: "investigating" }, { id: "dan", signoff: true }), /closed/);
});

test("files: checked by their first bytes, not only their name", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  assert.equal(fileProblem({ name: "step.png", type: "image/png", size: png.length }, png), null);
  assert.ok(fileProblem({ name: "step.png", type: "image/png", size: 4 }, Buffer.from("<svg")), "not really a PNG");
  assert.ok(fileProblem({ name: "notes.html", type: "text/html", size: png.length }, png), "not a kind we take");
});

test("reports are kept 10 years, or 21 when a child was involved", () => {
  assert.equal(keepUntil("2026-10-09", false), "2036-10-09");
  assert.equal(keepUntil("2026-10-09", true), "2047-10-09");
  assert.equal(keepUntil("2028-02-29", false), "2038-03-01", "a leap day keeps until 1 March");
});

test("insights count by month, kind, hour and level, and the near misses for each accident", () => {
  const months = monthsEnding("2026-10-12", 3);
  assert.deepEqual(months, ["2026-08", "2026-09", "2026-10"]);
  const row = { siteId: "s", area: "Main pool", kind: "near_miss", category: "slip_trip_fall", occurredOn: "2026-10-01", occurredAt: "10:15", serious: false, hsaReportable: false, severityActual: 1, severityPotential: 2 };
  const i = summarise([row, { ...row, occurredAt: "12:05" }, { ...row, kind: "accident", area: " ", occurredOn: "2026-08-03", serious: true, severityActual: null, severityPotential: null }], months);
  assert.equal(i.total, 3);
  assert.equal(i.nearMissRatio, 2);
  assert.deepEqual(i.months.map((m) => m.count), [1, 0, 2]);
  assert.deepEqual(i.hours.map((h) => [h.key, h.count]), [["10:00", 2], ["11:00", 0], ["12:00", 1]], "empty hours at the ends trimmed, gaps kept");
  assert.equal(i.areas.find((a) => a.key === "Not given")?.count, 1);
  assert.deepEqual([i.levels.find((l) => l.key === "2")?.count, i.untriaged, i.serious], [2, 1, 1]);
  assert.equal(summarise([row], months).nearMissRatio, null, "no accidents, no ratio");
});
