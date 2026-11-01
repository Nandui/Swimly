import assert from "node:assert/strict";
import test from "node:test";
import { incidentStatuses, seriousMeta, SEVERITY_META } from "@/modules/incidents";
import {
  actionOutcomeSchema, actionProblem, actionSchema, addendumSchema, addWorkingDays, closeSchema, investigable, investigationSchema, keepUntil, KEEP_YEARS, MAX_FILE_BYTES, MAX_FILES,
  monthsEnding, needsParent, needsRootCause, reopenSchema, safeFileName, summarise, cleanWhys, closeDecision, fileProblem, isSerious, IncidentError, needsSignoff, reopenDecision,
  reportProblem, reportSchema, statementProblem, statementSchema, triageDecision, triageSchema,
} from "./rules";
import { cleanTriageAnswers, injuryGuide, staffSupportCheck, triageAnswerRows, triageChecks, triageGuide } from "./triage-guides";
import { actionStatus, incidentCategories, incidentNumber, levelOf, MAX_WHYS, severities } from "./types";

const who = { id: "dan", name: "Dan", orgId: null, superadmin: false, review: true, signoff: false };
const row = { status: "reported", reporterId: "mia", occurredOn: "2026-10-09", serious: false, severityActual: null, severityPotential: null, hsaReportable: null, category: "slip_trip_fall", hasChild: false, hasStaff: false };
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

test("triage asks what fits the kind of report, and keeps only those answers", () => {
  assert.throws(() => triageDecision({ ...row, category: "lost_child" }, who, triage()), /parent or guardian/, "a missing child always needs the parent told");
  const theft = triageDecision({ ...row, category: "security" }, who, triage({ answers: { whose: "customer", gardaiTold: true, gardaiRef: " 12345678 ", contaminant: "vomit", whose2: "x" } }));
  assert.deepEqual(theft.triageAnswers, { whose: "customer", gardaiTold: true, gardaiRef: "12345678", cctvKept: false }, "the theft questions only; the insurer only for the centre's property");
  const noGardai = triageDecision({ ...row, category: "security" }, who, triage({ answers: { gardaiRef: "123" } }));
  assert.equal("gardaiRef" in noGardai.triageAnswers, false, "no number unless the Gardaí were told");
  const abuse = triageDecision({ ...row, category: "behaviour" }, who, triage({ answers: { aimedAt: "staff", staffSupport: "Debrief with Sam" } }));
  assert.equal(abuse.triageAnswers.staffSupport, "Debrief with Sam", "support for a staff member it was aimed at");
  assert.equal("staffSupport" in triageDecision(row, who, triage({ answers: { staffSupport: "x" } })).triageAnswers, false, "not asked with no staff member");
  assert.deepEqual(triageDecision(row, who, triage({ answers: { gardaiTold: true } })).triageAnswers, {}, "an injury asks nothing new");
  const staff = triageDecision({ ...row, category: "staff" }, who, triage({ answers: { matter: "welfare", hrTold: true, staffSupport: "Sent home early; manager rang next day" } }));
  assert.deepEqual(staff.triageAnswers, { matter: "welfare", managerTold: false, hrTold: true, staffSupport: "Sent home early; manager rang next day" }, "a staff matter always asks about support, once");
  assert.deepEqual(triageAnswerRows({ category: "security", hasStaff: false }, theft.triageAnswers), [["Whose property", "A customer's"], ["The Gardaí were told", "Yes"], ["Garda incident number", "12345678"], ["CCTV saved", "No"]]);
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

test("the front door's tags: each status its own icon, and each severity its number and word, never green from moderate up", () => {
  const statuses = Object.values(incidentStatuses);
  assert.equal(new Set(statuses.map((s) => s.icon)).size, statuses.length, "colour is never the only signal");
  const reached = [
    triageDecision(row, who, triage()).status,
    triageDecision(row, who, triage({ outcome: "investigate" })).status,
    reopenDecision({ status: "closed", reporterId: "mia" }, { id: "dan", signoff: true }).status,
  ];
  for (const status of reached) assert.ok(Object.hasOwn(incidentStatuses, status), `${status} has a tag`);
  assert.equal(seriousMeta.label, "Serious");
  for (const [level, s] of Object.entries(severities)) {
    const tag = SEVERITY_META[Number(level) as keyof typeof SEVERITY_META];
    assert.equal(tag.label, `${level} ${s.label}`);
    if (Number(level) >= 3) assert.notEqual(tag.color, "green", `${s.label} needs a manager, so it does not look fine`);
  }
  assert.equal(levelOf(1, 4), 4, "a report is handled at the worse of what happened and what could have");
  assert.equal(incidentNumber(42), "INC-00042");
});

test("a report is from the last year; older ones go to a manager", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  assert.equal(reportProblem(report({ occurredOn: "2025-10-11" }), now), null, "a year ago today is still in");
  assert.match(reportProblem(report({ occurredOn: "2025-10-10" }), now)!, /last year/);
  assert.throws(() => report({ occurredAt: "24:00" }), /time it happened/);
  assert.throws(() => report({ people: Array(11).fill(person) }), /Up to 10 people/);
});

test("the parent must be told when a child is named or missing; a root cause is needed wherever a manager signs off", () => {
  assert.equal(needsParent({ category: "slip_trip_fall", hasChild: false }), false);
  assert.equal(needsParent({ category: "slip_trip_fall", hasChild: true }), true);
  assert.equal(needsParent({ category: "lost_child", hasChild: false }), true);
  for (const r of [{ serious: true, severityActual: 1, severityPotential: 1 }, { serious: false, severityActual: 1, severityPotential: 3 }, { serious: false, severityActual: 2, severityPotential: 2 }])
    assert.equal(needsRootCause(r), needsSignoff(r));
  assert.equal(needsSignoff({ serious: false, severityActual: 2, severityPotential: 2 }), false, "minor: whoever triages may close");
  assert.equal(needsSignoff({ serious: false, severityActual: null, severityPotential: null }), false, "not yet rated");
});

test("an investigation is worked on only while open, and never by the person who reported it", () => {
  assert.doesNotThrow(() => investigable({ status: "investigating", reporterId: "mia" }, { id: "dan" }));
  assert.throws(() => investigable({ status: "investigating", reporterId: "dan" }, { id: "dan" }), /your own report/);
  assert.throws(() => investigable({ status: "closed", reporterId: "mia" }, { id: "dan" }), /under investigation/);
  assert.throws(() => investigable({ status: "reported", reporterId: "mia" }, { id: "dan" }), /under investigation/, "triage comes first");
  const close = { note: "Step edge replaced and checked.", hsaReference: "" };
  assert.throws(() => closeDecision({ ...row, rootCause: "x" }, who, close, 0), /under investigation/);
  assert.throws(() => closeDecision({ ...row, status: "investigating", reporterId: "dan", rootCause: "" }, who, close, 0), /your own report/);
  assert.throws(() => closeDecision({ ...row, status: "investigating", rootCause: "" }, who, close, 1), /One action is still open/);
});

test("each form asks for enough to be useful: a reason to reopen, words in an addendum, at most five whys, an action done or dropped", () => {
  assert.throws(() => reopenSchema.parse({ reason: "New facts" }), /Say why/);
  assert.equal(reopenSchema.parse({ reason: "  The parent sent a GP letter.  " }).reason, "The parent sent a GP letter.");
  assert.throws(() => addendumSchema.parse({ note: "  " }), /Write the addendum/);
  assert.throws(() => closeSchema.parse({ note: "Done.", hsaReference: "" }), /what was found/);
  assert.equal(investigationSchema.parse({ whys: Array(MAX_WHYS).fill("Why"), rootCause: "" }).whys.length, 5);
  assert.throws(() => investigationSchema.parse({ whys: Array(MAX_WHYS + 1).fill("Why"), rootCause: "" }), /Up to 5/);
  assert.equal(actionOutcomeSchema.parse({ outcome: "cancelled", note: "Not needed" }).outcome, "cancelled");
  assert.throws(() => actionOutcomeSchema.parse({ outcome: "open", note: "Again" }));
  const now = new Date("2026-10-11T12:00:00Z");
  const action = actionSchema.parse({ title: "Replace the step edge", ownerId: "sam", dueOn: "2027-10-12" });
  assert.equal(actionProblem(action, now), null, "366 days ahead is still allowed");
  assert.match(actionProblem({ ...action, dueOn: "2027-10-13" }, now)!, /within the next year/);
});

test("every category triages with a guide that rates 1 to 5, and the HSA's dangerous-occurrence question only where it can apply", () => {
  for (const category of Object.keys(incidentCategories)) {
    const guide = triageGuide(category);
    assert.deepEqual(Object.keys(guide.scale), ["1", "2", "3", "4", "5"], category);
    assert.ok(guide.intro.length > 10, category);
  }
  assert.equal(triageGuide("slip_trip_fall"), injuryGuide);
  assert.equal(triageGuide("not-a-category").label, "Something else", "an unknown category asks the general questions");
  assert.equal(triageGuide("chemical").dangerous, true);
  assert.equal(triageGuide("lost_child").dangerous, false);
  assert.equal(injuryGuide.scale[4], severities[4].help, "an injury uses the one severity scale's words");
});

test("triage asks a follow-on question only once its answer makes it relevant, and about support whenever a staff member is involved", () => {
  const keys = (category: string, answers = {}, hasStaff = false) => triageChecks({ category, hasStaff }, answers).map((c) => c.key);
  assert.deepEqual(keys("contamination"), ["contaminant", "poolClosed", "waterTested"]);
  assert.deepEqual(keys("contamination", { poolClosed: true }), ["contaminant", "poolClosed", "closedFor", "waterTested"]);
  assert.ok(keys("security", { whose: "centre" }).includes("insurerTold"));
  assert.ok(!keys("security", { whose: "staff" }).includes("insurerTold"));
  assert.deepEqual(keys("slip_trip_fall", {}, true), [staffSupportCheck.key]);
  assert.deepEqual(keys("behaviour", { aimedAt: "staff" }).filter((k) => k === "staffSupport"), ["staffSupport"]);
  assert.deepEqual(keys("staff", {}, true).filter((k) => k === "staffSupport"), ["staffSupport"], "asked once, even when the guide asks too");

  const context = { category: "contamination", hasStaff: false };
  assert.deepEqual(cleanTriageAnswers(context, { contaminant: "glitter", poolClosed: "yes", closedFor: "14:10 to 15:05", waterTested: true }),
    { poolClosed: false, waterTested: true }, "an unknown choice is dropped, a tick is only true when ticked, and a follow-on needs its answer");
  assert.equal(cleanTriageAnswers(context, { poolClosed: true, closedFor: `  ${"x".repeat(400)} ` }).closedFor, "x".repeat(300), "text is trimmed and kept short");
  assert.equal("closedFor" in cleanTriageAnswers(context, { poolClosed: true, closedFor: "   " }), false, "blank text is not an answer");
  assert.deepEqual(triageAnswerRows(context, null), [], "nothing stored, nothing shown");
});

test("files: a photo or a PDF up to 4 MB, its name made safe to store", () => {
  const jpeg = Buffer.from([255, 216, 255, 224]);
  const pdf = Buffer.from("%PDF-1.7");
  const webp = Buffer.from("RIFF0000WEBPVP8 ");
  assert.equal(fileProblem({ name: "Step.JPG", type: "image/jpeg", size: jpeg.length }, jpeg), null);
  assert.equal(fileProblem({ name: "letter.pdf", type: "application/pdf", size: pdf.length }, pdf), null);
  assert.equal(fileProblem({ name: "step.webp", type: "image/webp", size: webp.length }, webp), null);
  assert.ok(fileProblem({ name: "letter.png", type: "application/pdf", size: pdf.length }, pdf), "the name must match the kind");
  assert.ok(fileProblem({ name: "letter.pdf", type: "application/pdf", size: 99 }, pdf), "the size given must be the size sent");
  assert.ok(fileProblem({ name: "empty.pdf", type: "application/pdf", size: 0 }, Buffer.alloc(0)));
  const full = Buffer.concat([pdf, Buffer.alloc(MAX_FILE_BYTES - pdf.length)]);
  assert.equal(fileProblem({ name: "full.pdf", type: "application/pdf", size: full.length }, full), null, "4 MB exactly is allowed");
  const over = Buffer.concat([full, Buffer.alloc(1)]);
  assert.ok(fileProblem({ name: "over.pdf", type: "application/pdf", size: over.length }, over), "one byte over is not");
  assert.equal(MAX_FILES, 10);
  assert.equal(safeFileName("../poolside\\photo\n1.jpg"), ".._poolside_photo_1.jpg");
  assert.equal(safeFileName("x".repeat(250)).length, 200);
  assert.equal(KEEP_YEARS, 10);
});
