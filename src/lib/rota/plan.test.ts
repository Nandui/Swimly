import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlan, hours, type PlanShift } from "./plan";

/** Invented people and departments; the shape the week loads. */
const pool = { name: "Pool", sortOrder: 1 }, gym = { name: "Gym", sortOrder: 2 };
const shift = (id: string, who: string | null, role: string, start: number, end: number, extra: Partial<PlanShift> = {}): PlanShift => ({
  id, kind: "shift", startMinutes: start, endMinutes: end, role, note: "", importId: null, userId: who ? `u-${who}` : null, rotaPersonId: null,
  departmentId: "d-pool", user: who ? { name: who } : null, rotaPerson: null, department: pool, requiredType: null, warnings: [], ...extra,
});
const week = (byDay: PlanShift[][]) => Array.from({ length: 7 }, (_, i) => ({ iso: `2026-10-0${5 + i}`.replace(/0(\d\d)$/, "$1"), shifts: byDay[i] ?? [] }));

test("one row per duty, grouped by department in their order, days across", () => {
  const plan = buildPlan(week([
    [shift("a", "Ava Sample", "Poolside", 840, 1320), shift("b", "Ben Sample", "Poolside", 360, 840), shift("g", "Cal Sample", "Gym floor", 360, 840, { departmentId: "d-gym", department: gym })],
    [shift("c", null, "poolside ", 360, 840, { requiredType: { name: "NPLQ" } })],
    [shift("old", "Dee Sample", "Pool", 360, 840, { departmentId: null, department: null, importId: "imp" }), { ...shift("h", "Ava Sample", "Pool", 0, 0), kind: "holiday" }],
  ]));
  assert.deepEqual(plan.groups.map((g) => [g.label, g.rows.map((r) => r.duty)]), [["Pool", ["Poolside"]], ["Gym", ["Gym floor"]], ["No department", ["Pool"]]]);
  const poolside = plan.groups[0].rows[0];
  assert.deepEqual(poolside.days[0].map((e) => [e.text, e.who]), [["06:00–14:00", "Ben Sample"], ["14:00–22:00", "Ava Sample"]], "sorted by time");
  assert.deepEqual([poolside.days[1][0].who, poolside.needs], [null, "Needs NPLQ"], "an unfilled duty stays on its row; the same duty whatever its case");
  assert.equal(plan.groups[2].rows[0].days[2][0].editable, false, "old imported shifts are shown, not changed");
  assert.equal(plan.groups.flatMap((g) => g.rows).flatMap((r) => r.days[2]).length, 1, "holiday is not a duty");
  assert.deepEqual([plan.onShift[0], plan.unfilled[1], hours(plan.dayMinutes[0])], [3, 1, "24"]);
});

test("absent people do not count as on shift", () => {
  const plan = buildPlan(week([[shift("a", "Ava Sample", "Poolside", 390, 840, { warnings: ["absent", "missing"] })]]));
  const entry = plan.groups[0].rows[0].days[0][0];
  assert.deepEqual([entry.absent, entry.warnings], [true, ["missing"]]);
  assert.equal(plan.onShift[0], 0);
  assert.equal(hours(465), "7.75");
});
