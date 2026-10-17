import assert from "node:assert/strict";
import { test } from "node:test";
import { instructorAttendanceTotals, type AttendanceOccurrence } from "@/modules/activities/features/analytics/server/reports";

const now = new Date("2026-09-17T12:00:00Z"); // Thursday, 13:00 Dublin.
const base: AttendanceOccurrence = { courseId: "c", date: "2026-09-14", className: "Example class", location: null, startMinutes: 600, durationMinutes: 30,
  instructorId: "teacher", instructorName: "Teacher Example", scheduledName: "Teacher Example", started: true, cancelled: false,
  expected: 3, marked: 3, present: 2, absent: 1, late: 0, savedBy: ["Colleague Example"], lastSavedAt: new Date("2026-09-14T10:00:00Z") };

test("instructor report separates saved, partial and missing from upcoming, in-progress, cancelled and empty", () => {
  const result = instructorAttendanceTotals([
    base,
    { ...base, courseId: "partial", marked: 1 },
    { ...base, courseId: "missing", marked: 0, started: false },
    { ...base, courseId: "cancelled", marked: 0, cancelled: true },
    { ...base, courseId: "empty", expected: 0, marked: 0 },
    { ...base, courseId: "future-day", date: "2026-09-18", marked: 0 },
    { ...base, courseId: "future-time", date: "2026-09-17", startMinutes: 800, marked: 0 },
    { ...base, courseId: "running", date: "2026-09-17", startMinutes: 770, marked: 0 },
    { ...base, courseId: "just-finished", date: "2026-09-17", startMinutes: 750, marked: 0 },
  ], now);
  assert.deepEqual(result.classes.map(row => row.status), ["saved", "partial", "missing", "cancelled", "empty", "upcoming", "upcoming", "in_progress", "missing"]);
  assert.deepEqual(result.totals, { due: 4, saved: 1, partial: 1, missing: 2 });
  assert.equal(result.instructors[0].upcoming, 2);
  assert.equal(result.instructors[0].inProgress, 1);
  assert.deepEqual(result.classes[0].savedBy, ["Colleague Example"]);
});

test("all-absent saved registers count, but a class start without marks does not", () => {
  const result = instructorAttendanceTotals([
    { ...base, instructorId: null, instructorName: "Former Example", present: 0, absent: 3 },
    { ...base, courseId: "started-only", marked: 0, lastSavedAt: null, savedBy: [] },
  ], now);
  assert.deepEqual(result.totals, { due: 2, saved: 1, partial: 0, missing: 1 });
  assert.equal(result.instructors.length, 2);
  assert.equal(result.classes[0].instructorKey, "retained:Former Example");
  assert.equal(result.classes[1].status, "missing");
});
