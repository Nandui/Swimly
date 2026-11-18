import assert from "node:assert/strict";
import { test } from "node:test";
import { ANY_WEEK, kindsOfWorkProblem, mayStandAlone, sessionSchema, usualDayText, usualWeekSchema } from "./rules";

/** D33's two rules: an activity names one kind of work, and work belongs to an activity. */

test("a new activity names exactly one kind of work", () => {
  assert.equal(kindsOfWorkProblem(1, null), null);
  assert.match(kindsOfWorkProblem(0, null) ?? "", /Choose the kind of work/);
  assert.match(kindsOfWorkProblem(2, null) ?? "", /one kind of work/);
});

test("an activity made before the rule keeps its lines, can lose them, and gains no more", () => {
  assert.equal(kindsOfWorkProblem(2, 2), null);
  assert.equal(kindsOfWorkProblem(1, 2), null);
  assert.equal(kindsOfWorkProblem(0, 0), null);
  assert.match(kindsOfWorkProblem(3, 2) ?? "", /one kind of work/);
  assert.match(kindsOfWorkProblem(2, 1) ?? "", /one kind of work/);
});

test("only a break stands by itself, and a block that already did before the rule", () => {
  assert.equal(mayStandAlone({ isBreak: true, before: null }), true);
  assert.equal(mayStandAlone({ isBreak: false, before: null }), false);
  assert.equal(mayStandAlone({ isBreak: false, before: { sessionId: null } }), true);
  // Taking a block off its activity is not a way round the rule.
  assert.equal(mayStandAlone({ isBreak: false, before: { sessionId: "open" } }), false);
});

const activity = { siteId: "site", title: "Pool checks", areaId: null, start: 660, end: 720, weekdays: [0, 1, 2], firstDay: "2026-11-17", lastDay: "2026-12-17" };

test("an activity takes a kind of work from the list, or names a new one, never both", () => {
  assert.equal(sessionSchema.safeParse({ ...activity, needs: [{ dutyId: "guard", count: 1 }] }).success, true);
  const made = sessionSchema.safeParse({ ...activity, newDuty: { name: " Pool checks ", departmentId: "", count: 1 } });
  assert.equal(made.success, true);
  assert.deepEqual(made.success ? made.data.newDuty : null, { name: "Pool checks", departmentId: null, count: 1 });
  assert.equal(sessionSchema.safeParse({ ...activity, needs: [{ dutyId: "guard", count: 1 }], newDuty: { name: "Pool checks", departmentId: null, count: 1 } }).success, false);
  assert.equal(sessionSchema.safeParse({ ...activity, newDuty: { name: "P", departmentId: null, count: 1 } }).success, false);
});

test("a usual week says something for all seven days, and only a part day keeps times (D34)", () => {
  const days = ANY_WEEK.map((d) => ({ ...d }));
  assert.equal(usualWeekSchema.safeParse({ days }).success, true);
  assert.equal(usualWeekSchema.safeParse({ days: days.slice(0, 6) }).success, false, "six days");
  const part = (start: number | null, end: number | null) => usualWeekSchema.safeParse({ days: [{ mode: "between", start, end }, ...days.slice(1)] });
  assert.equal(part(16 * 60, 21 * 60).success, true);
  assert.equal(part(16 * 60, null).success, false, "a part day needs both times");
  assert.equal(part(21 * 60, 16 * 60).success, false, "the end comes after the start");
  assert.equal(part(16 * 60 + 3, 21 * 60).success, false, "5-minute steps");
  const off = usualWeekSchema.parse({ days: [{ mode: "none", start: 60, end: 120 }, ...days.slice(1)] });
  assert.deepEqual(off.days[0], { mode: "none", start: null, end: null }, "a day off keeps no times");
  assert.equal(usualWeekSchema.safeParse({ days: [{ mode: "maybe" }, ...days.slice(1)] }).success, false);
});

test("a planner reads a usual day in plain words, and nothing when any time suits", () => {
  assert.equal(usualDayText({ mode: "any", start: null, end: null }), null);
  assert.equal(usualDayText(undefined), null);
  assert.equal(usualDayText({ mode: "none", start: null, end: null }), "Can't work");
  assert.equal(usualDayText({ mode: "between", start: 16 * 60, end: 21 * 60 }), "Can work 16:00 to 21:00");
});
