import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsPeriod, enrolmentTotals, activityTotals } from "./rules";

test("analytics uses seven Dublin calendar days across midnight, year boundaries and DST", () => {
  const midnight = analyticsPeriod(new Date("2026-09-12T23:30:00Z"));
  assert.equal(midnight.date, "2026-09-13");
  assert.equal(midnight.weekStart, "2026-09-07");
  assert.equal(midnight.days.length, 7);
  assert.equal(analyticsPeriod(new Date("2027-01-01T00:30:00Z")).weekStart, "2026-12-26");
  assert.equal(analyticsPeriod(new Date("2026-12-31T12:00:00Z")).nextMonth, "2027-01-01");
  assert.equal(analyticsPeriod(new Date("2026-03-29T23:30:00Z")).date, "2026-03-30");
  assert.equal(analyticsPeriod(new Date("2026-10-25T23:30:00Z")).date, "2026-10-25");
});

test("level occupancy counts class places against summed capacity while the swimmer total stays distinct", () => {
  const definition = { sharedWithId: null, sortOrder: 0, archivedAt: null };
  const programmes = [{ ...definition, id: "p", name: "Swimming" }, { ...definition, id: "copy-p", name: "Old swimming", sharedWithId: "p" }];
  const levels = [
    { ...definition, id: "one", name: "First", programmeId: "p" },
    { ...definition, id: "copy-one", name: "Old first", programmeId: "copy-p", sharedWithId: "one" },
    { ...definition, id: "two", name: "Second", programmeId: "p", sortOrder: 1 },
    { ...definition, id: "zero", name: "Empty", programmeId: "p", sortOrder: 2 },
    { ...definition, id: "retired", name: "Retired", programmeId: "p", sortOrder: 3, archivedAt: new Date() },
    { ...definition, id: "unused-retired", name: "Hidden", programmeId: "p", archivedAt: new Date() },
  ];
  const result = enrolmentTotals([
    { studentId: "a", levelId: "one" }, { studentId: "a", levelId: "copy-one" },
    { studentId: "a", levelId: "two" }, { studentId: "b", levelId: "one" }, { studentId: "c", levelId: "retired" },
  ], levels, programmes, [
    { levelId: "one", capacity: 8, classes: 1 },
    { levelId: "copy-one", capacity: 4, classes: 1 },
    { levelId: "two", capacity: 2, classes: 1 },
    { levelId: "retired", capacity: 10, classes: 1 },
  ]);
  assert.equal(result.swimmers, 3);
  assert.equal(result.places, 5);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].levels.map(l => [l.name, l.count, l.capacity, l.percentage]), [
    ["First", 3, 12, 25], ["Second", 1, 2, 50], ["Empty", 0, 0, null], ["Retired", 1, 10, 10],
  ]);
  assert.equal(result.groups[0].levels[0].classes, 2);
});

test("uncapped, zero-capacity, empty and overfull levels never invent a finite maximum or hide overbooking", () => {
  const definition = { sharedWithId: null, sortOrder: 0, archivedAt: null };
  const programmes = [{ ...definition, id: "p", name: "Swimming" }];
  const levels = ["mixed", "uncapped-copy", "zero", "overfull", "empty", "archived"].map(id => ({
    ...definition, id, name: id, programmeId: "p", sharedWithId: id === "uncapped-copy" ? "mixed" : null,
    archivedAt: id === "archived" ? new Date() : null,
  }));
  const result = enrolmentTotals([
    { studentId: "a", levelId: "mixed" }, { studentId: "b", levelId: "uncapped-copy" },
    { studentId: "a", levelId: "overfull" }, { studentId: "b", levelId: "overfull" },
  ], levels, programmes, [
    { levelId: "mixed", capacity: 8, classes: 1 }, { levelId: "uncapped-copy", capacity: null, classes: 1 },
    { levelId: "zero", capacity: 0, classes: 1 }, { levelId: "overfull", capacity: 1, classes: 1 },
    { levelId: "empty", capacity: 8, classes: 1 }, { levelId: "archived", capacity: 8, classes: 1 },
  ]);
  const byId = new Map(result.groups[0].levels.map(level => [level.id, level]));
  assert.equal(byId.get("mixed")?.capacity, null);
  assert.equal(byId.get("mixed")?.percentage, null);
  assert.equal(byId.get("mixed")?.count, 2);
  assert.equal(byId.get("mixed")?.classes, 2);
  assert.equal(byId.get("zero")?.percentage, null);
  assert.equal(byId.get("overfull")?.percentage, 200);
  assert.equal(byId.get("empty")?.percentage, 0);
  assert.equal(byId.get("archived")?.capacity, 8);
});

test("empty activity days remain visible and totals do not include outside days", () => {
  const result = activityTotals(["2026-09-12", "2026-09-13"], [{ day: "2026-09-12", enrolled: 4, withdrawn: 2 }, { day: "2026-09-01", enrolled: 90, withdrawn: 90 }]);
  assert.equal(result.enrolled, 4); assert.equal(result.withdrawn, 2);
  assert.deepEqual(result.daily[1], { day: "2026-09-13", enrolled: 0, withdrawn: 0 });
});
