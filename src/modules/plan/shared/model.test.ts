import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakMinutesOwed, candidatesFor, copyWeek, fillsOf, gapsOf, laneClashes, mondayOf, needsOf, occurrencesOn, tasksOf, warningsOf, weekdayOfIso,
  type Block, type ClassItem, type DutyRef, type SessionDef, type Shift,
} from "./model";

/** Plan (test)'s day model with the owner's pool example (29 October 2026): the pool open needs two
 *  lifeguards, a school's lessons on lanes 1–2 add a teacher and one more lifeguard, and public swim
 *  in the rest needs nobody extra. Synthetic names only. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const THU = "2026-11-05";

const session = (change: Partial<SessionDef>): SessionDef => ({
  id: "s", title: "Session", areaId: "pool", lanes: [], start: h(7), end: h(21), weekdays: [0, 1, 2, 3, 4, 5, 6],
  firstDay: "2026-11-01", lastDay: "2026-12-31", skipDays: [], needs: [], days: [], ...change,
});
const poolOpen = session({ id: "open", title: "Pool open", needs: [{ dutyId: "lifeguard", count: 2 }] });
const lessons = session({ id: "school", title: "Lessons: Example School", lanes: [1, 2], start: h(10), end: h(11), weekdays: [3],
  needs: [{ dutyId: "teacher", count: 1 }, { dutyId: "lifeguard", count: 1 }] });
const publicSwim = session({ id: "public", title: "Public swim", lanes: [3, 4, 5, 6], start: h(7), end: h(21), needs: [] });

const duties = new Map<string, DutyRef>([
  ["lifeguard", { id: "lifeguard", name: "Lifeguard", qualificationTypeId: "nplq", isBreak: false, departmentId: "pool" }],
  ["teacher", { id: "teacher", name: "Swim teacher", qualificationTypeId: null, isBreak: false, departmentId: "pool" }],
  ["break", { id: "break", name: "Break", qualificationTypeId: null, isBreak: true, departmentId: null }],
]);
const block = (change: Partial<Block>): Block => ({ id: "b", shiftId: "x", dutyId: "lifeguard", sessionId: "open", start: h(7), end: h(15), ...change });
const shift = (change: Partial<Shift>): Shift => ({ id: "x", userId: "u", departmentId: "pool", siteId: "site", date: THU, start: h(7), end: h(15), blocks: [], ...change });

test("days of the week count from Monday", () => {
  assert.equal(weekdayOfIso(THU), 3);
  assert.equal(mondayOf(THU), "2026-11-02");
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
  assert.equal(mondayOf("2026-11-08"), "2026-11-02");
});

test("a session runs on its weekdays between its first and last day, except skipped and called-off days", () => {
  assert.deepEqual(occurrencesOn([lessons], THU).map((o) => o.sessionId), ["school"]);
  assert.deepEqual(occurrencesOn([lessons], "2026-11-06"), []);
  assert.deepEqual(occurrencesOn([{ ...lessons, skipDays: [THU] }], THU), []);
  assert.deepEqual(occurrencesOn([{ ...lessons, days: [{ date: THU, cancelled: true, start: null, end: null }] }], THU), []);
  assert.deepEqual(occurrencesOn([{ ...lessons, lastDay: "2026-11-04" }], THU), []);
  const moved = occurrencesOn([{ ...lessons, days: [{ date: THU, cancelled: false, start: h(12), end: h(13) }] }], THU)[0];
  assert.deepEqual([moved.start, moved.end], [h(12), h(13)]);
});

test("needs on the same area stack: the lessons add a lifeguard on top of the pool's two", () => {
  const needs = needsOf(occurrencesOn([poolOpen, lessons, publicSwim], THU), [], null, []);
  assert.deepEqual(needs.map((n) => `${n.title}: ${n.count} ${n.dutyId}`), [
    "Pool open: 2 lifeguard", "Lessons: Example School: 1 teacher", "Lessons: Example School: 1 lifeguard",
  ]);
  const lifeguardsAt10 = needs.filter((n) => n.dutyId === "lifeguard" && n.start <= h(10) && n.end >= h(11)).reduce((m, n) => m + n.count, 0);
  assert.equal(lifeguardsAt10, 3);
});

test("a gap is each stretch short of people, by how many; a lifeguard on the pool does not fill the lessons", () => {
  const [open, , lessonGuard] = needsOf(occurrencesOn([poolOpen, lessons], THU), [], null, []);
  const blocks = [block({ id: "a", start: h(7), end: h(15) }), block({ id: "b", start: h(9), end: h(13) })];
  assert.deepEqual(gapsOf(open, fillsOf(open, blocks, [])), [
    { start: h(7), end: h(9), short: 1 }, { start: h(13), end: h(15), short: 1 }, { start: h(15), end: h(21), short: 2 },
  ]);
  assert.deepEqual(gapsOf(lessonGuard, fillsOf(lessonGuard, blocks, [])), [{ start: h(10), end: h(11), short: 1 }]);
  const rotation = [block({ id: "c", sessionId: "school", start: h(10), end: h(10, 30) }), block({ id: "d", sessionId: "school", start: h(10, 30), end: h(11) })];
  assert.deepEqual(gapsOf(lessonGuard, fillsOf(lessonGuard, rotation, [])), []);
});

test("a class needs one place on the class duty, filled by its teacher, in the area named like its place", () => {
  const classes: ClassItem[] = [
    { ref: "c1", source: "activities.classes", title: "Level 3", place: "learner pool ", start: h(16), end: h(16, 30), userId: null, plannable: true },
    { ref: "c2", source: "activities.classes", title: "Level 4", place: "Gym", start: h(17), end: h(17, 30), userId: "u", plannable: true },
  ];
  const needs = needsOf([], classes, "teacher", [{ id: "learner", name: "Learner pool" }]);
  assert.deepEqual(needs.map((n) => [n.title, n.areaId, n.count]), [["Level 3", "learner", 1], ["Level 4", null, 1]]);
  assert.equal(gapsOf(needs[0], fillsOf(needs[0], [], classes)).length, 1);
  assert.equal(gapsOf(needs[1], fillsOf(needs[1], [], classes)).length, 0);
  assert.deepEqual(needsOf([], classes, null, []), [], "without a class duty, classes need nobody here");
});

test("breaks owed follow the handbook's lengths", () => {
  assert.deepEqual([h(4), h(5), h(7), h(8), h(10), h(11)].map(breakMinutesOwed), [0, 15, 45, 60, 60, 75]);
});

test("warnings: off, overlap, outside the shift, qualification, class clash and breaks owed; none block", () => {
  const held = (userId: string, typeId: string) => !(userId === "u" && typeId === "nplq");
  const base = { duties, qualificationNames: new Map([["nplq", "NPLQ"]]), held, off: new Set<string>(), classes: [] as ClassItem[], elsewhere: [] as Shift[] };
  const s = shift({ blocks: [
    block({ id: "1", start: h(7), end: h(10) }), block({ id: "2", start: h(9), end: h(11) }), block({ id: "3", dutyId: "teacher", sessionId: null, start: h(14), end: h(16) }),
  ] });
  const kinds = (w: { kind: string }[]) => [...new Set(w.map((x) => x.kind))].sort();
  assert.deepEqual(kinds(warningsOf({ ...base, shifts: [s] })), ["break", "outside", "overlap", "qualification"]);
  assert.deepEqual(kinds(warningsOf({ ...base, off: new Set(["v"]), shifts: [shift({ userId: "v", start: h(9), end: h(12) })] })), ["off"]);
  assert.deepEqual(kinds(warningsOf({ ...base, shifts: [shift({ userId: "v", start: h(9), end: h(12) })], elsewhere: [shift({ id: "y", userId: "v", siteId: "other", start: h(11), end: h(13) })] })), ["overlap"]);
  const teaching: ClassItem = { ref: "c", source: "activities.classes", title: "Level 3", place: "", start: h(9), end: h(9, 30), userId: "v", plannable: true };
  const busy = shift({ userId: "v", start: h(8), end: h(12), blocks: [block({ dutyId: "teacher", sessionId: null, start: h(8), end: h(10) }), block({ id: "br", dutyId: "break", sessionId: null, start: h(10), end: h(10, 15) })] });
  assert.deepEqual(kinds(warningsOf({ ...base, shifts: [busy], classes: [teaching] })), ["class"]);
  const ok = shift({ userId: "v", start: h(9), end: h(12), blocks: [block({ dutyId: "break", sessionId: null, start: h(10), end: h(10, 15) })] });
  assert.deepEqual(warningsOf({ ...base, shifts: [ok], classes: [teaching] }), []);
});

test("lanes taken twice at once clash; the whole area open alongside lanes does not", () => {
  const lanes = new Map([["pool", 6]]);
  const lane2 = session({ id: "hire", title: "Lane hire", lanes: [2, 3], start: h(10, 30), end: h(12) });
  assert.deepEqual(laneClashes(occurrencesOn([poolOpen, lessons, publicSwim], THU), lanes), []);
  assert.deepEqual(laneClashes(occurrencesOn([lessons, lane2], THU), lanes).map((c) => c.text), ["Lessons: Example School and Lane hire both take lane 2."]);
});

test("a duty's tasks land at its start, end or set time, inside the block", () => {
  const tasks = [{ name: "Close the till", when: "end", atMinutes: null }, { name: "Open the till", when: "start", atMinutes: null },
    { name: "Pool test", when: "at", atMinutes: h(12) }, { name: "Late check", when: "at", atMinutes: h(20) }];
  assert.deepEqual(tasksOf({ start: h(9), end: h(13) }, tasks), [{ name: "Open the till", at: h(9) }, { name: "Pool test", at: h(12) }, { name: "Close the till", at: h(13) }]);
});

test("who could fill a stretch: people on shift then, qualified first, then free, then the department's own", () => {
  const shifts = [
    shift({ id: "a", userId: "unqualified", start: h(7), end: h(15) }),
    shift({ id: "b", userId: "busy", start: h(7), end: h(15), blocks: [block({ start: h(10), end: h(11) })] }),
    shift({ id: "c", userId: "borrowed", start: h(9), end: h(15) }),
    shift({ id: "d", userId: "own", start: h(9), end: h(12) }),
    shift({ id: "e", userId: "late", start: h(12), end: h(20) }),
  ];
  const held = (userId: string) => userId !== "unqualified";
  const departmentOf = (userId: string) => userId === "borrowed" ? ["gym"] : ["pool"];
  assert.deepEqual(candidatesFor({ start: h(10), end: h(11) }, "lifeguard", { shifts, duties, held, departmentOf }).map((c) => c.userId), ["own", "borrowed", "busy", "unqualified"]);
});

test("copying a week moves shifts on seven days, keeps fills of sessions still running, skips the off and the already planned", () => {
  const last = [
    shift({ id: "1", userId: "a", date: "2026-10-29", blocks: [block({ sessionId: "school" }), block({ id: "own", sessionId: null })] }),
    shift({ id: "2", userId: "b", date: "2026-10-29" }),
    shift({ id: "3", userId: "c", date: "2026-10-30" }),
  ];
  const copied = copyWeek(last, { existing: [{ userId: "c", date: "2026-11-06" }], offOn: (u) => u === "b", runsOn: (id) => id !== "school" });
  assert.deepEqual(copied.map((s) => [s.userId, s.date, s.blocks.map((b) => b.id)]), [["a", THU, ["own"]]]);
});
