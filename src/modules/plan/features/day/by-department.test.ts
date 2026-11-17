import assert from "node:assert/strict";
import { test } from "node:test";
import { dayByDepartment, needIsFor, shortByDepartment } from "./by-department";

/** The Day by department: a pool open all day that the lifeguards cover in turns, a booking and a
 *  lesson, a desk that belongs to reception, a duty with no department, a duty given by itself, a
 *  break, a class someone teaches and free time. Synthetic names only. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const block = (id: string, dutyId: string, sessionId: string | null, start: number, end: number) => ({ id, dutyId, sessionId, start, end });
const shifts = [
  { id: "sa", userId: "ann", departmentId: "pool", start: h(6), end: h(14), classes: [],
    blocks: [block("a1", "guard", "open", h(6, 30), h(10, 30)), block("a2", "break", null, h(10, 30), h(11)), block("a3", "checks", null, h(11), h(12))] },
  { id: "sb", userId: "ben", departmentId: "pool", start: h(9), end: h(15), classes: [], blocks: [block("b1", "guard", "open", h(10, 30), h(15))] },
  { id: "sc", userId: "cat", departmentId: "swim", start: h(15), end: h(18), classes: [{ start: h(15, 30), end: h(16), source: "swim", ref: "stars", title: "Starfish (A)" }], blocks: [] },
  { id: "sd", userId: "dan", departmentId: "desk", start: h(8), end: h(16), classes: [], blocks: [block("d1", "desk", "front", h(8), h(16)), block("d2", "guard", "club", h(9), h(10))] },
];
const needs = [
  { key: "s:open:guard", kind: "session" as const, sessionId: "open", label: "Pool open", dutyId: "guard", start: h(6, 30), end: h(21),
    fills: [{ start: h(6, 30), end: h(10, 30), blockId: "a1" }, { start: h(10, 30), end: h(15), blockId: "b1" }], gaps: [{ start: h(15), end: h(21), short: 1 }] },
  { key: "s:club:guard", kind: "session" as const, sessionId: "club", label: "Swim club", dutyId: "guard", start: h(9), end: h(10, 30),
    fills: [{ start: h(9), end: h(10), blockId: "d2" }], gaps: [{ start: h(10), end: h(10, 30), short: 1 }] },
  { key: "c:swim:stars", kind: "class" as const, sessionId: null, label: "Starfish (A)", dutyId: "teach", start: h(15, 30), end: h(16), fills: [{ start: h(15, 30), end: h(16), userId: "cat" }], gaps: [] },
  { key: "s:front:desk", kind: "session" as const, sessionId: "front", label: "Desk open", dutyId: "desk", start: h(8), end: h(20), fills: [{ start: h(8), end: h(16), blockId: "d1" }], gaps: [{ start: h(16), end: h(20), short: 1 }] },
  { key: "s:drill:aid", kind: "session" as const, sessionId: "drill", label: "Fire drill", dutyId: "aid", start: h(12), end: h(12, 30), fills: [], gaps: [{ start: h(12), end: h(12, 30), short: 2 }] },
];
const departmentOf: Record<string, string | null> = { guard: "pool", checks: "pool", break: null, teach: "swim", desk: "desk", aid: null };
const dutyDepartment = (dutyId: string) => departmentOf[dutyId] ?? null;
const day = (departmentId: string) => dayByDepartment({ departmentId, needs, shifts, dutyDepartment, isBreak: (id) => id === "break" });

test("a need belongs to its duty's department, and one whose duty has none shows in every department", () => {
  assert.equal(needIsFor("pool", "pool"), true);
  assert.equal(needIsFor("pool", "desk"), false);
  assert.equal(needIsFor("pool", null), true);
  assert.deepEqual([...day("pool").standing, ...day("pool").booked].map((l) => l.key), ["s:open:guard", "s:club:guard", "s:drill:aid"]);
  assert.deepEqual([...day("swim").standing, ...day("swim").booked].map((l) => l.key), ["s:drill:aid", "c:swim:stars"]);
});

test("what runs for three hours or more has a line of its own; shorter things share one", () => {
  const pool = day("pool");
  assert.deepEqual(pool.standing.map((l) => l.label), ["Pool open"]);
  assert.deepEqual(pool.booked.map((l) => l.label), ["Swim club", "Fire drill"]);
  assert.deepEqual(day("desk").standing.map((l) => l.label), ["Desk open"]);
});

test("a line reads who is on it stretch by stretch, then the stretches nobody fills", () => {
  const open = day("pool").standing[0];
  assert.deepEqual(open.stretches.map((s) => [s.userId, s.start, s.end, s.short]), [["ann", h(6, 30), h(10, 30), 0], ["ben", h(10, 30), h(15), 0], [null, h(15), h(21), 1]]);
  assert.deepEqual(open.stretches.map((s) => s.open), ["block|sa|a1", "block|sb|b1", "gap|s:open:guard|0"]);
});

test("someone borrowed from another department is named on the need they fill", () => {
  const club = day("pool").booked.find((l) => l.key === "s:club:guard");
  assert.deepEqual(club?.stretches.map((s) => [s.userId, s.open]), [["dan", "block|sd|d2"], [null, "gap|s:club:guard|0"]]);
});

test("a class opens as the class, by its teacher", () => {
  const stars = day("swim").booked.find((l) => l.key === "c:swim:stars");
  assert.deepEqual(stars?.stretches.map((s) => s.open), ["class|c:swim:stars|cat"]);
});

test("other work is a duty given by itself in the department, never a break", () => {
  assert.deepEqual(day("pool").other.map((w) => [w.userId, w.dutyId, w.open]), [["ann", "checks", "block|sa|a3"]]);
  assert.deepEqual(day("desk").other, []);
});

test("who is in: the department's shifts, earliest first, each with its duties, break, class and free time", () => {
  const pool = day("pool");
  assert.deepEqual(pool.people.map((p) => p.userId), ["ann", "ben"]);
  assert.deepEqual(pool.people[0].stints.map((s) => [s.kind, s.start, s.end, s.what]), [
    ["free", h(6), h(6, 30), null], ["duty", h(6, 30), h(10, 30), "Pool open"], ["break", h(10, 30), h(11), null], ["duty", h(11), h(12), null], ["free", h(12), h(14), null],
  ]);
  const cat = day("swim").people[0];
  assert.deepEqual(cat.stints.map((s) => [s.kind, s.open]), [["free", "free|sc|900|930"], ["class", "class|c:swim:stars|cat"], ["free", "free|sc|960|1080"]]);
});

test("the count to fill is the department's unfilled stretches, and each department has its own", () => {
  assert.equal(day("pool").short, 3);
  assert.deepEqual([...shortByDepartment(["pool", "swim", "desk"], needs, dutyDepartment)], [["pool", 3], ["swim", 1], ["desk", 2]]);
});
