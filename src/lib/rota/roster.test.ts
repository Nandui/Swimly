import assert from "node:assert/strict";
import { test } from "node:test";
import { diffRoster, isoWeekMonday, parseRoster, RosterError, sameName } from "./roster";

/** A synthetic week in the payroll export's shape. Names are invented. */
const HEADER = ["EmpNo", "EmployeeName", "Mon-28/09", "Dept", "Tue-29/09", "Dept", "Wed-30/09", "Dept", "Thu-01/10", "Dept", "Fri-02/10", "Dept", "Sat-03/10", "Dept", "Sun-04/10", "Dept", "Total"];
const row = (no: number | string, name: string, days: Record<number, [string, string]>, total: number | string = "") => {
  const cells: unknown[] = [no, name];
  for (let i = 0; i < 7; i++) cells.push(days[i]?.[0] ?? null, days[i]?.[1] ?? null);
  return [...cells, total];
};

test("ISO week 40 of 2026 starts on Monday 28 September", () => {
  assert.equal(isoWeekMonday(2026, 40), "2026-09-28");
  assert.equal(isoWeekMonday(2026, 1), "2025-12-29");
});

test("shifts, a second shift on another row, holidays and other codes are read; totals are ignored", () => {
  const parsed = parseRoster("Roster for 2026-W40", [
    HEADER,
    row(14, "Sample Pat", { 0: ["06:30 - 14:00", "100"], 6: ["FHOP", "100"] }, 17),
    row(14, "Sample Pat", { 0: ["18:00 - 20:00", "310"] }),
    row(22, "Example  Jo ", { 2: ["18:30 - 01:00", "760"], 4: ["TOIL", "520"] }, 10),
    row(1006, "EF Test", {}),
    row("", "Overall Total", {}, 1484.25),
  ]);
  assert.equal(parsed.weekStart, "2026-09-28");
  assert.deepEqual(parsed.people, [{ employeeNo: "14", name: "Sample Pat" }, { employeeNo: "22", name: "Example Jo" }]);
  assert.deepEqual(parsed.entries.map((e) => [e.employeeNo, e.date, e.kind, e.start, e.end, e.department, e.code]), [
    ["14", "2026-09-28", "shift", 390, 840, "100", ""],
    ["14", "2026-10-04", "holiday", 0, 0, "100", "FHOP"],
    ["14", "2026-09-28", "shift", 1080, 1200, "310", ""],
    ["22", "2026-09-30", "shift", 1110, 1500, "760", ""],
    ["22", "2026-10-02", "leave", 0, 0, "520", "TOIL"],
  ]);
  assert.deepEqual(parsed.problems, []);
});

test("unreadable cells are reported, never guessed", () => {
  const parsed = parseRoster("Roster for 2026-W40", [HEADER, row(9, "Sample Sam", { 1: ["about 9", "100"], 3: ["09:00 - 17:00", ""] })]);
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.problems.length, 2);
});

test("a file for another week, or not a roster at all, is refused", () => {
  assert.throws(() => parseRoster("Sheet1", [HEADER]), RosterError);
  assert.throws(() => parseRoster("Roster for 2026-W41", [HEADER]), /Mon-05\/10/);
  assert.throws(() => parseRoster("Roster for 2026-W40", [["Name", "Shift"]]), RosterError);
});

test("a re-upload lists what was added, removed and changed, day by day", () => {
  const first = parseRoster("Roster for 2026-W40", [HEADER,
    row(1, "Sample Pat", { 0: ["06:30 - 14:00", "100"], 1: ["06:30 - 14:00", "100"] }),
    row(2, "Example Jo", { 0: ["09:00 - 17:00", "200"] })]).entries;
  const second = parseRoster("Roster for 2026-W40", [HEADER,
    row(1, "Sample Pat", { 0: ["07:00 - 14:00", "100"], 1: ["06:30 - 14:00", "100"], 2: ["FHOP", "100"] })]).entries;
  assert.deepEqual(diffRoster(first, second).map((c) => [c.name, c.date, c.kind, c.before, c.after]), [
    ["Example Jo", "2026-09-28", "removed", "09:00–17:00 · 200", ""],
    ["Sample Pat", "2026-09-28", "changed", "06:30–14:00 · 100", "07:00–14:00 · 100"],
    ["Sample Pat", "2026-09-30", "added", "", "Full holiday (paid) · 100"],
  ]);
});

test("roster names match accounts written the other way round", () => {
  assert.equal(sameName("O Halloran Eoin", "Eoin O'Halloran"), true);
  assert.equal(sameName("Mc Conville Lynn", "Lynn McConville"), true);
  assert.equal(sameName("Sample Pat", "Pat Samples"), false);
});
