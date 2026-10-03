import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoster, type RosterShift } from "./roster";

/** Invented people and departments; the shape the week loads. */
const pool = { name: "Pool", sortOrder: 1 }, desk = { name: "Reception", sortOrder: 2 };
const shift = (id: string, who: string | null, role: string, start: number, end: number, extra: Partial<RosterShift> = {}): RosterShift => ({
  id, kind: "shift", startMinutes: start, endMinutes: end, role, importId: null, userId: who ? `u-${who}` : null, rotaPersonId: null,
  departmentId: "d-pool", user: who ? { name: who } : null, rotaPerson: null, department: pool, segments: [], warnings: [], ...extra,
});
const week = (byDay: RosterShift[][]) => Array.from({ length: 7 }, (_, i) => ({ iso: `2026-10-${String(12 + i).padStart(2, "0")}`, shifts: byDay[i] ?? [] }));

test("one row per person, in the department they work most, a cell per day saying when and what", () => {
  const roster = buildRoster(week([
    [shift("a1", "Ava Sample", "Poolside", 420, 900, { segments: [
      { startMinutes: 420, endMinutes: 570, kind: "activity", label: "25m pool" },
      { startMinutes: 570, endMinutes: 600, kind: "break", label: "Unpaid break" },
      { startMinutes: 600, endMinutes: 720, kind: "activity", label: "Lessons" },
      { startMinutes: 720, endMinutes: 735, kind: "break", label: "Paid break" },
    ] }), shift("n1", "Noah Sample", "Front desk", 720, 1080, { departmentId: "d-desk", department: desk })],
    [shift("a2", "Ava Sample", "Front desk", 720, 840, { departmentId: "d-desk", department: desk })],
  ]));
  assert.deepEqual(roster.groups.map((g) => [g.label, g.people.map((p) => p.name)]), [["Pool", ["Ava Sample"]], ["Reception", ["Noah Sample"]]]);
  const ava = roster.groups[0].people[0];
  assert.deepEqual(ava.days[0].map((c) => [c.time, c.what]), [["07:00–15:00", "25m pool, Lessons"]], "what they mainly do");
  assert.equal(ava.days[1][0].what, "Front desk", "no activities: the duty");
  assert.equal(ava.minutes, 480 - 30 + 120, "the unpaid break comes off, the paid one stays");
});

test("To fill: unfilled duties, booking places, and cover for someone off; the tiles count them", () => {
  const roster = buildRoster(week([[
    shift("o1", null, "Swim teacher", 960, 1140),
    shift("b1", null, "School lessons: Example NS", 570, 690, { bookingNeed: { role: "Lifeguard" } }),
    shift("r1", "Riley Sample", "Poolside", 900, 1320, { warnings: ["absent"] }),
    shift("s1", "Sam Sample", "Poolside", 720, 1020, { warnings: ["teaching"] }),
  ]]));
  assert.deepEqual(roster.fill[0].map((f) => [f.what, f.cover]), [["Swim teacher", null], ["Lifeguard: Example NS", null], ["Poolside", "Riley Sample"]]);
  const riley = roster.groups[0].people.find((p) => p.name === "Riley Sample")!;
  assert.deepEqual([riley.days[0][0].absent, riley.minutes], [true, 0], "off: not counted in their hours");
  assert.deepEqual(roster.tiles, { people: 2, minutes: 300, toFill: 3, offPeople: 1, offShifts: 1, warnings: 1 });
});
