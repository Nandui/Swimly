import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completionProblems, csvRows, dueOn, exceptions, score, scheduleLabel, taskState, tasksOn, templateProblems, windowOn, zonedInstant,
  type TaskDefinition, type TaskSchedule,
} from "./rules";

/** Tasks' pure rules: schedules, the centre's clock, completion, ranges and the score. */
const schedule = (patch: Partial<TaskSchedule>): TaskSchedule => ({ id: "s", repeat: "daily", every: 1, weekdays: [], from: "2026-01-31", start: "08:00", due: "10:00", ...patch });

test("schedules: daily, every other day, weekly on chosen days, monthly skipping short months, once", () => {
  assert.equal(dueOn(schedule({}), "2026-01-30"), false, "nothing before the first day");
  assert.equal(dueOn(schedule({ every: 2 }), "2026-02-02"), true);
  assert.equal(dueOn(schedule({ every: 2 }), "2026-02-01"), false);
  // 2026-02-02 is a Monday; fortnightly from the week of 31 January (a Saturday).
  const weekly = schedule({ repeat: "weekly", every: 2, weekdays: [1, 3] });
  assert.equal(dueOn(weekly, "2026-02-02"), false, "the second week is off");
  assert.equal(dueOn(weekly, "2026-02-09"), true);
  assert.equal(dueOn(weekly, "2026-02-11"), true);
  assert.equal(dueOn(weekly, "2026-02-10"), false, "not a chosen day");
  const monthly = schedule({ repeat: "monthly" });
  assert.equal(dueOn(monthly, "2026-02-28"), false);
  assert.equal(dueOn(monthly, "2026-03-31"), true);
  assert.equal(dueOn(schedule({ repeat: "once" }), "2026-01-31"), true);
  assert.equal(dueOn(schedule({ repeat: "once" }), "2026-02-01"), false);
  assert.equal(scheduleLabel(weekly), "Every 2 weeks on Mon, Wed, 08:00 to 10:00");
});

test("the centre's clock: summer and winter time, an overnight window, and the hour the clocks skip", () => {
  assert.equal(zonedInstant("2026-07-01", "09:00").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(zonedInstant("2026-12-01", "09:00").toISOString(), "2026-12-01T09:00:00.000Z");
  assert.throws(() => zonedInstant("2026-03-29", "01:30"), /clocks go forward/);
  const night = windowOn({ start: "22:00", due: "06:00" }, "2026-12-01");
  assert.equal(night.dueAt.toISOString(), "2026-12-02T06:00:00.000Z");
  assert.deepEqual(tasksOn([schedule({ start: "01:30", due: "02:30", from: "2026-03-29" })], "2026-03-29"), [], "a skipped hour makes no task rather than failing the day");
});

const day = "2026-10-08";
const at = (iso: string) => new Date(`${day}T${iso}:00.000Z`);
const timed = { date: day, startsAt: at("08:00"), dueAt: at("09:00"), completedAt: null, approvedAt: null, requiresApproval: false };

test("states: upcoming, to do, overdue, missed, done early or late, approval", () => {
  assert.equal(taskState({ ...timed, status: "open" }, at("07:00"), day), "upcoming");
  assert.equal(taskState({ ...timed, status: "open" }, at("08:30"), day), "open");
  assert.equal(taskState({ ...timed, status: "open" }, at("10:00"), day), "overdue");
  assert.equal(taskState({ ...timed, status: "open" }, at("10:00"), "2026-10-09"), "missed");
  assert.equal(taskState({ ...timed, status: "done", completedAt: at("07:30") }, at("10:00"), day), "early");
  assert.equal(taskState({ ...timed, status: "done", completedAt: at("09:30") }, at("10:00"), day), "late");
  assert.equal(taskState({ ...timed, status: "done", completedAt: at("08:30"), requiresApproval: true }, at("10:00"), day), "approval");
  assert.equal(taskState({ ...timed, status: "done", completedAt: at("08:30"), requiresApproval: true, approvedAt: at("09:30") }, at("10:00"), day), "approved");
});

test("the score: on time in full, late half, missed nothing; not applicable and not yet due left out", () => {
  assert.equal(score([]), null);
  assert.equal(score(["open", "upcoming", "not_applicable"]), null);
  assert.equal(score(["done", "late", "missed", "not_applicable", "open"]), 50);
  assert.equal(score(["early", "approved", "approval"]), 100);
  assert.equal(score(["cant_complete", "overdue"]), 0);
});

const water: TaskDefinition = {
  title: "Pool water quality", description: "", priority: true, tags: [], roleIds: [], checklist: ["Sample taken at the deep end"], minimumRecords: 1,
  requiresComment: false, requiresApproval: false,
  fields: [
    { id: "ph", label: "pH", type: "number", required: true, min: 7.2, max: 7.6, warning: "Check dosing and retest.", needsAction: true },
    { id: "temp", label: "Water temperature", type: "number", required: false, unit: "°C" },
    { id: "clear", label: "Water clarity", type: "choice", required: true, options: ["Clear", "Cloudy"] },
  ],
};

test("completion: ticks, required answers, a valid choice, a comment if asked, and an action for a reading out of range", () => {
  assert.deepEqual(completionProblems(water, [false], [{}], false, false), ["Tick every checklist item.", "pH needs an answer.", "Water clarity needs an answer."]);
  assert.deepEqual(completionProblems(water, [true], [{ ph: "x", clear: "Green" }], false, false), ["pH must be a number.", "Choose one of the answers for Water clarity."]);
  const high = [{ ph: "8.1", clear: "Clear" }];
  assert.deepEqual(completionProblems(water, [true], high, false, false), ["Raise a follow-up action for the reading out of range."]);
  assert.deepEqual(completionProblems(water, [true], high, false, true), []);
  assert.deepEqual(exceptions(water, high), ["pH 8.1 (7.2 to 7.6). Check dosing and retest."]);
  assert.deepEqual(completionProblems({ ...water, requiresComment: true }, [true], [{ ph: "7.4", clear: "Clear" }], false, false), ["Add a comment before completing it."]);
  assert.deepEqual(completionProblems({ ...water, minimumRecords: 2 }, [true], [{ ph: "7.4", clear: "Clear" }], false, false), ["Add at least 2 records."]);
});

test("a template cannot be published with nothing to do, a bad range or a schedule that cannot happen", () => {
  const base = { title: "Opening checks", checklist: ["Alarm tested"], fields: [], schedules: [schedule({})], minimumRecords: 1 };
  assert.deepEqual(templateProblems(base), []);
  assert.ok(templateProblems({ ...base, checklist: [] }).some((p) => p.includes("something to do")));
  assert.ok(templateProblems({ ...base, title: " " }).includes("Give the task a title."));
  assert.ok(templateProblems({ ...base, fields: [{ id: "a", label: "pH", type: "number", required: true, min: 8, max: 7 }] }).some((p) => p.includes("above the lowest")));
  assert.ok(templateProblems({ ...base, schedules: [schedule({ repeat: "weekly", weekdays: [] })] }).includes("Choose the days of the week it is due."));
  assert.ok(templateProblems({ ...base, schedules: [schedule({ from: "2026-03-29", start: "01:30", due: "03:00" })] }).some((p) => p.includes("clocks go forward")));
});

test("the export never hands a spreadsheet a formula", () => {
  assert.equal(csvRows([["=SUM(A1)", 'say "hi"']]), `"'=SUM(A1)","say ""hi"""`);
});
