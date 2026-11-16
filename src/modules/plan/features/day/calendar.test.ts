import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarOf, freeTimeOf, OTHER_GROUP, SPARE_GROUP } from "./calendar";

/** The Day as a calendar: a pool that needs two lifeguards all day with one place short in the
 *  afternoon, a class with nobody to teach it, a desk, a duty given by itself, breaks and free
 *  time. Synthetic names only. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const words = { classes: "Classes", otherDuties: "Other duties", notOn: "Not on anything", onBreak: "On a break", free: "Free" };
const names: Record<string, string> = { guard: "Lifeguard", desk: "Receptionist", clean: "Cleaning", break: "Break", teach: "Teacher" };
const areas = [
  { id: "pool", name: "Main pool", parentId: null },
  { id: "deep", name: "Deep end", parentId: "pool" },
  { id: "desk", name: "Front desk", parentId: null },
];
const block = (id: string, dutyId: string, sessionId: string | null, start: number, end: number) => ({ id, dutyId, sessionId, start, end });
const shifts = [
  { id: "sa", userId: "ann", start: h(7), end: h(15), classes: [], blocks: [block("a1", "guard", "open", h(7), h(11)), block("a2", "break", null, h(11), h(12)), block("a3", "guard", "open", h(12), h(14))] },
  { id: "sb", userId: "ben", start: h(7), end: h(15), classes: [], blocks: [block("b1", "guard", "open", h(7), h(14)), block("b2", "clean", null, h(14), h(15))] },
  { id: "sc", userId: "cat", start: h(14), end: h(18), classes: [{ start: h(16), end: h(16, 30) }], blocks: [block("c1", "guard", "open", h(14), h(15))] },
  { id: "sd", userId: "dan", start: h(9), end: h(13), classes: [], blocks: [block("d1", "desk", "front", h(9), h(13)), block("d2", "break", null, h(11), h(11, 30))] },
];
const needs = [
  { key: "s:open:guard", kind: "session" as const, sessionId: "open", label: "Pool open", where: "Deep end", placeAreaId: "deep", dutyId: "guard", start: h(7), end: h(17),
    fills: [{ start: h(7), end: h(11), blockId: "a1" }, { start: h(12), end: h(14), blockId: "a3" }, { start: h(7), end: h(14), blockId: "b1" }, { start: h(14), end: h(15), blockId: "c1" }],
    gaps: [{ start: h(11), end: h(12), short: 1 }, { start: h(14), end: h(15), short: 1 }, { start: h(15), end: h(17), short: 2 }] },
  { key: "c:swim:seals", kind: "class" as const, sessionId: null, label: "Seals (B)", where: "Main pool", placeAreaId: "pool", dutyId: "teach", start: h(15, 45), end: h(16, 15), fills: [], gaps: [{ start: h(15, 45), end: h(16, 15), short: 1 }] },
  { key: "c:swim:stars", kind: "class" as const, sessionId: null, label: "Starfish (A)", where: "Main pool", placeAreaId: "pool", dutyId: "teach", start: h(16), end: h(16, 30), fills: [{ start: h(16), end: h(16, 30), userId: "cat" }], gaps: [] },
  { key: "s:front:desk", kind: "session" as const, sessionId: "front", label: "Desk open", where: "Front desk", placeAreaId: "desk", dutyId: "desk", start: h(9), end: h(13), fills: [{ start: h(9), end: h(13), blockId: "d1" }], gaps: [] },
  { key: "s:fair:desk", kind: "session" as const, sessionId: "fair", label: "Open day stand", where: "No area", placeAreaId: null, dutyId: "desk", start: h(10), end: h(12), fills: [], gaps: [{ start: h(10), end: h(12), short: 1 }] },
];
const day = (shown = shifts) => calendarOf({ areas, needs, shifts, shown, words, dutyName: (id) => names[id] ?? "Duty", isBreak: (id) => id === "break" });
const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

test("the groups are the areas with something on, then places that are no area, other duties and people on nothing", () => {
  assert.deepEqual(day().map((g) => g.label), ["Main pool", "Front desk", "No area", "Other duties", "Not on anything"]);
  assert.deepEqual(day().map((g) => g.key).slice(-2), [OTHER_GROUP, SPARE_GROUP]);
});

test("an area's parts sit in the area's group, and it counts what is short there", () => {
  const pool = day()[0];
  assert.equal(pool.short, 2, "Pool open and Seals (B)");
  assert.equal(day()[1].short, 0);
});

test("a duty has as many columns as people are on it at once, and classes come last", () => {
  const pool = day()[0];
  assert.deepEqual(pool.columns.map((c) => c.label), ["Lifeguard", "Lifeguard", "Classes", "Classes"]);
  for (const column of pool.columns) for (const a of column.entries) for (const b of column.entries) assert.ok(a === b || !overlap(a, b), `${column.key} holds two blocks at once`);
});

test("a gap is a block in a column, once for each person short, and opens that gap", () => {
  const gaps = day()[0].columns.flatMap((c) => c.entries).filter((e) => e.kind === "gap" && e.what === "Pool open");
  assert.equal(gaps.filter((e) => e.start === h(15)).length, 2, "two short from 15:00");
  assert.deepEqual([...new Set(gaps.filter((e) => e.start === h(15)).map((e) => e.pick))], ["gap|s:open:guard|2"]);
  assert.equal(new Set(gaps.map((e) => e.key)).size, gaps.length, "every block has its own key");
});

test("someone on a duty opens their own block; a class opens the class", () => {
  const entries = day()[0].columns.flatMap((c) => c.entries);
  assert.equal(entries.find((e) => e.userIds[0] === "ann" && e.start === h(7))?.pick, "block|sa|a1");
  const taught = entries.find((e) => e.what === "Starfish (A)");
  assert.deepEqual([taught?.userIds, taught?.pick], [["cat"], "item|c:swim:stars"]);
});

test("a duty given by itself is under other duties", () => {
  const other = day().find((g) => g.key === OTHER_GROUP);
  assert.deepEqual(other?.columns.map((c) => [c.label, c.entries.map((e) => e.userIds[0])]), [["Cleaning", ["ben"]]]);
});

test("breaks take a column each when they overlap; free time is one column naming everyone free then", () => {
  const spare = day().find((g) => g.key === SPARE_GROUP);
  assert.deepEqual(spare?.columns.map((c) => c.label), ["On a break", "On a break", "Free"]);
  const free = spare?.columns[2].entries ?? [];
  assert.deepEqual(free.map((e) => [e.start, e.end, e.userIds]), [[h(14), h(15), ["ann"]], [h(15), h(16), ["cat"]], [h(16, 30), h(18), ["cat"]]]);
  assert.equal(free[0].pick, `spare|${h(14)}|${h(15)}`);
});

test("picking a department narrows the people on nothing, never what is on", () => {
  const one = day(shifts.filter((s) => s.userId === "dan"));
  assert.equal(one[0].columns.flatMap((c) => c.entries).filter((e) => e.kind === "on").length, 5);
  assert.equal(one.find((g) => g.key === OTHER_GROUP), undefined);
  assert.deepEqual(one.find((g) => g.key === SPARE_GROUP)?.columns.map((c) => c.label), ["On a break"]);
});

test("free time is what a shift's duties, breaks and classes leave", () => {
  assert.deepEqual(freeTimeOf(shifts[2]), [{ start: h(15), end: h(16) }, { start: h(16, 30), end: h(18) }]);
  assert.deepEqual(freeTimeOf(shifts[0]), [{ start: h(14), end: h(15) }]);
});
