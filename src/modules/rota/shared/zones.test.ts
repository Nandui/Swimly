import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay, type DayType } from "@/modules/rota/shared/day";
import { bandRows } from "@/modules/rota/shared/zones";

/** The zones at the top of the Plan (owner request, 13 October 2026). Invented site and people. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const types: DayType[] = [
  { id: "guard", name: "Lifeguarding", icon: "lifeguard", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: false },
  { id: "hire", name: "Lane hire", icon: "activity", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: false },
  { id: "teach", name: "Teaching", icon: "teaching", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: true },
];
const need = (id: string, typeId: string, place: string, a: string, b: string, lanes: number[] = [], repeatTitle: string | null = null) =>
  ({ id, typeId, place, startMinutes: h(a), endMinutes: h(b), places: 1, note: "", repeatTitle, lanes });

const day = buildDay({
  date: "2026-10-19", types, names: new Map([["ciara", "Ciara Murphy"]]),
  areas: [{ name: "Main pool", lanes: 4 }, { name: "Learner pool", lanes: 0 }, { name: "Gym", lanes: 0 }],
  needs: [
    need("guard", "guard", "Main pool", "07:00", "22:00"),
    need("school", "hire", "Main pool", "09:30", "11:30", [3, 4], "St Joseph's NS"),
    need("masters", "hire", "Main pool", "18:00", "19:00", [], "Cork Masters"),
  ],
  assignments: [{ id: "a1", needId: "guard", place: 1, userId: "ciara", startMinutes: h("07:00"), endMinutes: h("15:00") }],
  classes: [{ ref: "c1", userId: null, startMinutes: h("16:00"), endMinutes: h("16:30"), title: "Sharks 1", place: "Main pool, lane 3", planned: false }],
});

test("every area on the site's list is a zone, in order, even with nothing on", () => {
  assert.deepEqual(day.areas.map((a) => [a.name, a.lanes, a.items.length]), [["Main pool", 4, 4], ["Learner pool", 0, 0], ["Gym", 0, 0]]);
});

test("each thing using an area says what it is, its lanes and its places still to fill", () => {
  const main = day.areas[0].items;
  assert.deepEqual(main.map((i) => [i.kind, i.label, i.lanes, i.gaps]), [
    ["activity", "Lifeguarding", [], 1],
    ["booking", "St Joseph's NS", [3, 4], 1],
    ["class", "Sharks 1", [3], 1],
    ["booking", "Cork Masters", [], 1],
  ]);
});

test("a pool is a row across it, then a row per lane; a whole-pool booking takes every lane", () => {
  const rows = bandRows(day.areas[0]);
  assert.deepEqual(rows.map((r) => [r.lane, r.head, r.items.map((i) => i.label)]), [
    [null, true, ["Lifeguarding"]],
    [1, false, ["Cork Masters"]],
    [2, false, ["Cork Masters"]],
    [3, false, ["St Joseph's NS", "Sharks 1", "Cork Masters"]],
    [4, false, ["St Joseph's NS", "Cork Masters"]],
  ]);
  assert.deepEqual(rows.flatMap((r) => r.clashes), []);
});

test("two things on one lane at once show as a clash, on separate rows", () => {
  const clash = buildDay({ date: "2026-10-19", types, names: new Map(), areas: [{ name: "Main pool", lanes: 2 }],
    needs: [need("a", "hire", "Main pool", "09:00", "10:00", [1], "Club A"), need("b", "hire", "Main pool", "09:30", "10:30", [], "Club B")], assignments: [], classes: [] });
  const lane1 = bandRows(clash.areas[0]).filter((r) => r.lane === 1);
  assert.equal(lane1.length, 2);
  assert.deepEqual(lane1[0].clashes.sort(), ["need:a", "need:b"]);
});

test("an area without lanes stacks overlapping things into rows", () => {
  const gym = buildDay({ date: "2026-10-19", types, names: new Map(), areas: ["Gym"],
    needs: [need("a", "guard", "Gym", "09:00", "12:00"), need("b", "hire", "Gym", "10:00", "11:00"), need("c", "hire", "Gym", "12:00", "13:00")], assignments: [], classes: [] });
  assert.deepEqual(bandRows(gym.areas[0]).map((r) => r.items.map((i) => i.needId)), [["a", "c"], ["b"]]);
});
