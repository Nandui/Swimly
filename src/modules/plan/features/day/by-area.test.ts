import assert from "node:assert/strict";
import { test } from "node:test";
import { dayByArea, freeTimeOf } from "./by-area";

/** The Day by area: a pool that needs two lifeguards with a part of its own, a desk, a class, a
 *  stand in no area, someone who works in two areas, a duty given by itself, breaks and free time.
 *  Synthetic names only. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const areas = [
  { id: "pool", name: "Main pool", parentId: null },
  { id: "deep", name: "Deep end", parentId: "pool" },
  { id: "desk", name: "Front desk", parentId: null },
  { id: "gym", name: "Gym", parentId: null },
];
const block = (id: string, dutyId: string, sessionId: string | null, start: number, end: number) => ({ id, dutyId, sessionId, start, end });
const shifts = [
  { id: "sa", userId: "ann", start: h(7), end: h(15), classes: [], blocks: [block("a1", "guard", "open", h(7), h(11)), block("a2", "break", null, h(11), h(12)), block("a3", "desk", "front", h(12), h(14))] },
  { id: "sb", userId: "ben", start: h(7), end: h(15), classes: [], blocks: [block("b1", "guard", "open", h(7), h(14)), block("b2", "clean", null, h(14), h(15))] },
  { id: "sc", userId: "cat", start: h(14), end: h(18), classes: [{ start: h(16), end: h(16, 30) }], blocks: [] },
];
const needs = [
  { key: "s:open:guard", kind: "session" as const, sessionId: "open", label: "Pool open", where: "Deep end", placeAreaId: "deep", dutyId: "guard", start: h(7), end: h(17),
    fills: [{ start: h(7), end: h(11), blockId: "a1" }, { start: h(7), end: h(14), blockId: "b1" }],
    gaps: [{ start: h(11), end: h(14), short: 1 }, { start: h(14), end: h(17), short: 2 }] },
  { key: "c:swim:stars", kind: "class" as const, sessionId: null, label: "Starfish (A)", where: "Main pool", placeAreaId: "pool", dutyId: "teach", start: h(16), end: h(16, 30), fills: [{ start: h(16), end: h(16, 30), userId: "cat" }], gaps: [] },
  { key: "s:front:desk", kind: "session" as const, sessionId: "front", label: "Desk open", where: "Front desk", placeAreaId: "desk", dutyId: "desk", start: h(12), end: h(14), fills: [{ start: h(12), end: h(14), blockId: "a3" }], gaps: [] },
  { key: "s:fair:desk", kind: "session" as const, sessionId: "fair", label: "Open day stand", where: "No area", placeAreaId: null, dutyId: "desk", start: h(10), end: h(12), fills: [], gaps: [{ start: h(10), end: h(12), short: 1 }] },
];
const day = (shown = shifts) => dayByArea({ areas, needs, shifts, shown, isBreak: (id) => id === "break" });

test("the groups are the areas with something on, in the areas' order, then places that are no area", () => {
  assert.deepEqual(day().groups.map((g) => g.label), ["Main pool", "Front desk", "No area"]);
});

test("an area's parts sit in the area, which counts the things on there that still need someone", () => {
  const pool = day().groups[0];
  assert.deepEqual(pool.items.map((i) => [i.label, i.short, i.userIds]), [["Pool open", 2, ["ann", "ben"]], ["Starfish (A)", 0, ["cat"]]]);
  assert.equal(pool.short, 1);
  assert.equal(day().groups[1].short, 0);
});

test("each gap is listed in its area with what it opens", () => {
  assert.deepEqual(day().groups[0].gaps.map((g) => [g.needKey, g.index, g.start, g.short]), [["s:open:guard", 0, h(11), 1], ["s:open:guard", 1, h(14), 2]]);
  assert.deepEqual(day().groups[2].gaps.map((g) => g.label), ["Open day stand"]);
});

test("a person has a line under each area they work in, with only their time there", () => {
  const [pool, desk] = day().groups;
  assert.deepEqual(pool.people.map((p) => [p.userId, p.stints.map((s) => [s.start, s.end])]), [["ann", [[h(7), h(11)]]], ["ben", [[h(7), h(14)]]], ["cat", [[h(16), h(16, 30)]]]]);
  assert.deepEqual(desk.people.map((p) => [p.userId, p.stints.map((s) => [s.start, s.end])]), [["ann", [[h(12), h(14)]]]]);
});

test("a duty opens the person's own block; a class has none and opens the class", () => {
  const pool = day().groups[0];
  assert.deepEqual([pool.people[0].stints[0].shiftId, pool.people[0].stints[0].blockId, pool.people[0].stints[0].itemKey], ["sa", "a1", "s:open"]);
  assert.deepEqual([pool.people[2].stints[0].blockId, pool.people[2].stints[0].itemKey], [null, "c:swim:stars"]);
});

test("outside every area: breaks, duties given by themselves and free time, a line per person", () => {
  assert.deepEqual(day().rest.map((r) => [r.userId, r.stints.map((s) => [s.kind, s.start, s.end])]), [
    ["ann", [["break", h(11), h(12)], ["free", h(14), h(15)]]],
    ["ben", [["duty", h(14), h(15)]]],
    ["cat", [["free", h(14), h(16)], ["free", h(16, 30), h(18)]]],
  ]);
});

test("picking a department narrows the lines outside the areas, never who is in an area", () => {
  const one = day(shifts.filter((s) => s.userId === "cat"));
  assert.deepEqual(one.rest.map((r) => r.userId), ["cat"]);
  assert.equal(one.groups[0].people.length, 3);
});

test("free time is what a shift's duties, breaks and classes leave", () => {
  assert.deepEqual(freeTimeOf(shifts[2]), [{ start: h(14), end: h(16) }, { start: h(16, 30), end: h(18) }]);
  assert.deepEqual(freeTimeOf(shifts[0]), [{ start: h(14), end: h(15) }]);
});
