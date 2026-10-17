import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay, type DayType } from "@/modules/rota/shared/day";
import { byArea, coverOf, freeTime, needRows, partPaid, personBlocks } from "@/modules/rota/shared/plan-rows";

/** The shift-first Plan (owner, 13 October 2026). Invented site and people. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const types: DayType[] = [
  { id: "guard", name: "Lifeguarding", icon: "lifeguard", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: false },
  { id: "hire", name: "Lane hire", icon: "activity", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: false },
  { id: "desk", name: "Reception", icon: "activity", departmentId: "front", requiredTypeId: null, requiredName: null, fromClasses: false },
  { id: "teach", name: "Teaching", icon: "teaching", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: true },
];
const need = (id: string, typeId: string, place: string, a: string, b: string, places: number, repeatTitle: string | null = null) =>
  ({ id, typeId, place, startMinutes: h(a), endMinutes: h(b), places, note: "", repeatTitle });
const on = (id: string, needId: string, place: number, userId: string, a: string, b: string) => ({ id, needId, place, userId, startMinutes: h(a), endMinutes: h(b) });

const day = buildDay({
  date: "2026-10-19", types, names: new Map([["ciara", "Ciara Murphy"], ["sean", "Seán Byrne"]]), areas: ["Main pool", "Learner pool", "Front desk"],
  needs: [need("main", "guard", "Main pool", "07:00", "15:00", 2), need("school", "hire", "Main pool", "09:30", "11:30", 1, "St Joseph's NS"), need("desk", "desk", "Front desk", "07:00", "15:00", 1)],
  assignments: [on("a1", "main", 1, "ciara", "07:00", "11:00"), on("a2", "main", 2, "sean", "07:00", "15:00"), on("a3", "desk", 1, "ciara", "12:00", "15:00")],
  classes: [{ ref: "c1", userId: null, startMinutes: h("16:00"), endMinutes: h("16:30"), title: "Sharks 1", place: "Learner pool", planned: false }],
  planned: [{ id: "s1", userId: "ciara", departmentId: "pool", startMinutes: h("07:00"), endMinutes: h("15:00") }],
});

test("one row per activity and per booking, swim classes together", () => {
  assert.deepEqual(needRows(day.groups).map((r) => [r.kind, r.label, r.gaps]), [
    ["booking", "St Joseph's NS", 1],
    ["activity", "Lifeguarding", 1],
    ["classes", "Swim classes", 1],
    ["activity", "Reception", 1],
  ]);
});

test("what needs people goes area by area, in the site's order, each area's things by start", () => {
  const areas = byArea(needRows(day.groups), ["Front desk", "Learner pool", "Main pool"]);
  assert.deepEqual(areas.map((a) => [a.place, a.rows.map((r) => r.label), a.gaps]), [
    ["Front desk", ["Reception"], 1],
    ["Learner pool", ["Swim classes"], 1],
    ["Main pool", ["Lifeguarding", "St Joseph's NS"], 2],
  ]);
});

test("cover counts people against places, stretch by stretch", () => {
  const main = needRows(day.groups)[1];
  assert.deepEqual(main.cover.map((c) => [c.start / 60, c.end / 60, c.have, c.want, !!c.gap]), [
    [7, 11, 2, 2, false],
    [11, 15, 1, 2, true],
  ]);
  assert.deepEqual(coverOf([]), []);
});

test("a person's day comes from every department, so lending shows on their row", () => {
  assert.deepEqual(personBlocks(day.groups, "ciara").map((x) => [x.group.name, x.block.start / 60]), [["Lifeguarding", 7], ["Reception", 12]]);
});

test("time in a shift with nothing on and no break is free, ready to give to something", () => {
  const ciara = day.people.find((p) => p.userId === "ciara")!;
  const free = freeTime(ciara, personBlocks(day.groups, "ciara").map((x) => x.block));
  const part = ciara.shift.parts[0];
  const placed = part.breaks.reduce((n, b) => n + b.end - b.start, 0);
  assert.ok(free.every((s) => s.start >= h("11:00") && s.end <= h("12:00")), "only 11:00 to 12:00 has nothing on");
  assert.equal(free.reduce((n, s) => n + s.end - s.start, 0) + placed, 60, "that hour is either a break or free");
  assert.deepEqual(partPaid(ciara.shift.parts[0]), { paid: 8 * 60 - 30, unpaid: 30 });
});

test("someone covering part of an activity shows as their own stretch, with no gap (owner request, 16 October 2026)", () => {
  const zone = buildDay({
    date: "2026-10-19", types, names: new Map([["ciara", "Ciara Murphy"], ["sean", "Seán Byrne"]]), areas: ["Main pool"],
    needs: [need("fz", "guard", "Main pool", "09:00", "14:00", 1)],
    assignments: [on("a1", "fz", 1, "ciara", "09:00", "10:00"), on("a2", "fz", 1, "sean", "10:00", "11:00"), on("a3", "fz", 1, "ciara", "11:00", "14:00")],
    classes: [],
  });
  const row = needRows(zone.groups)[0];
  assert.equal(row.gaps, 0);
  assert.deepEqual(row.cover.map((c) => [c.start / 60, c.end / 60, c.have, c.want]), [[9, 10, 1, 1], [10, 11, 1, 1], [11, 14, 1, 1]]);
});

test("a split shift keeps its parts apart: paid hours add up, the time off is not paid", () => {
  const split = buildDay({
    date: "2026-10-19", types, names: new Map([["ciara", "Ciara Murphy"]]), areas: ["Main pool"], needs: [], assignments: [], classes: [],
    planned: [{ id: "s1", userId: "ciara", departmentId: "pool", startMinutes: h("07:00"), endMinutes: h("11:00") }, { id: "s2", userId: "ciara", departmentId: "pool", startMinutes: h("17:00"), endMinutes: h("21:00") }],
  });
  const ciara = split.people[0];
  assert.deepEqual(ciara.shift.parts.map((x) => [x.start / 60, x.end / 60]), [[7, 11], [17, 21]]);
  assert.equal(ciara.shift.paidMinutes, 8 * 60);
});
