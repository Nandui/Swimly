import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_CLASSES, filterClassChoices } from "./class-picker";
import { formatTimeRange } from "@/lib/courses/constants";
import type { TransferTarget } from "./data/enrolments";

function course(id: string, changes: Partial<TransferTarget> = {}): TransferTarget {
  return {
    id, name: null, clubId: "bishopstown", club: { id: "bishopstown", name: "Bishopstown" },
    level: { id: "turtles", name: "Turtles" }, dayOfWeek: "MONDAY", startMinutes: 960,
    durationMinutes: 30, location: "Learner Pool", instructor: { name: "Demo Instructor" },
    capacity: 8, _count: { enrolments: 5 }, ...changes,
  };
}

const courses = [
  course("later", { dayOfWeek: "WEDNESDAY", startMinutes: 1020 }),
  course("full", { capacity: 5 }),
  course("churchfield", { clubId: "churchfield", club: { id: "churchfield", name: "Churchfield" }, dayOfWeek: "THURSDAY", startMinutes: 990 }),
  course("uncapped", { capacity: null, _count: { enrolments: 99 } }),
  course("other-level", { level: { id: "dolphins", name: "Dolphins" } }),
];

test("combines site, level, day and exact start time across the shared timetable", () => {
  const filters = { ...ALL_CLASSES, site: "churchfield", level: "turtles", day: "THURSDAY", time: "990" };
  assert.deepEqual(filterClassChoices(courses, filters).map(c => c.id), ["churchfield"]);
  assert.deepEqual(filterClassChoices(courses, { ...filters, site: "bishopstown" }), []);
  assert.deepEqual(filterClassChoices(courses, { ...filters, time: "960" }), []);
});

test("available-only includes uncapped classes and hides full or over-capacity classes", () => {
  const rows = [...courses, course("overfull", { capacity: 2 }), course("zero-capacity", { capacity: 0, _count: { enrolments: 0 } })];
  const available = filterClassChoices(rows, ALL_CLASSES).map(c => c.id);
  assert.ok(available.includes("uncapped"));
  for (const id of ["full", "overfull", "zero-capacity"]) assert.ok(!available.includes(id));
  assert.equal(filterClassChoices(rows, { ...ALL_CLASSES, availableOnly: false }).length, rows.length);
});

test("search combines case-insensitive words from site, time, level, pool and instructor", () => {
  assert.deepEqual(filterClassChoices(courses, { ...ALL_CLASSES, search: "  CHURCHFIELD turtles Thursday 16:30 learner Demo " }).map(c => c.id), ["churchfield"]);
  assert.deepEqual(filterClassChoices(courses, { ...ALL_CLASSES, search: "Churchfield Monday" }), []);
});

test("results are ordered through the week and filtering does not mutate the source", () => {
  const ids = courses.map(c => c.id);
  const rows = filterClassChoices(courses, { ...ALL_CLASSES, level: "turtles" });
  assert.deepEqual(rows.map(c => c.id), ["uncapped", "later", "churchfield"]);
  assert.deepEqual(courses.map(c => c.id), ids);
});

test("time ranges use the actual class duration", () => {
  assert.equal(formatTimeRange({ startMinutes: 990, durationMinutes: 45 }), "16:30–17:15");
});
