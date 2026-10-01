import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSheet, hours, type SheetShift } from "./sheet";

/** Invented people; the shape the week loads. */
const base = { note: "", importId: "imp", userId: null, user: null, requiredType: null, warnings: [] as SheetShift["warnings"] };
const shift = (id: string, person: string | null, role: string, start: number, end: number, extra: Partial<SheetShift> = {}): SheetShift => ({
  ...base, id, kind: "shift", startMinutes: start, endMinutes: end, role, departmentCode: role === "Pool" ? "100" : "200",
  rotaPersonId: person, rotaPerson: person ? { name: person, employeeNo: person.slice(0, 3) } : null, ...extra,
});
const week = (byDay: SheetShift[][]) => Array.from({ length: 7 }, (_, i) => ({ iso: `2026-09-${28 + i}`, shifts: byDay[i] ?? [] }));

test("one row per person in the department they work most, days across, with hours", () => {
  const sheet = buildSheet(week([
    [shift("a1", "Ava Sample", "Pool", 390, 840), shift("b1", "Ben Sample", "Reception", 540, 1050)],
    [shift("a2", "Ava Sample", "Reception", 600, 720), shift("a3", "Ava Sample", "Pool", 780, 900)],
    [{ ...shift("b2", "Ben Sample", "Reception", 0, 0), kind: "holiday" }],
  ]), () => "Holiday");
  assert.deepEqual(sheet.groups.map((g) => [g.label, g.rows.map((r) => r.name)]), [["Pool", ["Ava Sample"]], ["Reception", ["Ben Sample"]]]);
  const ava = sheet.groups[0].rows[0];
  assert.deepEqual(ava.days[1].map((e) => [e.text, e.department]), [["10:00–12:00", "Reception"], ["13:00–15:00", null]], "sorted by time; the other department is named");
  assert.equal(hours(ava.minutes), "11.5");
  assert.equal(sheet.groups[1].rows[0].days[2][0].kind, "holiday");
  assert.deepEqual(sheet.onShift.slice(0, 3), [2, 1, 0]);
});

test("unfilled shifts get their own row; absent people do not count as on shift", () => {
  const sheet = buildSheet(week([[shift("o1", null, "Pool", 360, 600), shift("a1", "Ava Sample", "Pool", 390, 840, { warnings: ["absent"] })]]), () => "");
  assert.equal(sheet.open?.days[0][0].department, "Pool");
  assert.equal(sheet.groups[0].rows[0].days[0][0].absent, true);
  assert.equal(sheet.onShift[0], 0);
  assert.equal(hours(90), "1.5");
  assert.equal(hours(465), "7.75");
});
