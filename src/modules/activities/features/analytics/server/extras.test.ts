import assert from "node:assert/strict";
import { test } from "node:test";
import type { CourseRow, LessonRow, PlaceRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { cancellations, continuity, forecast, parentTakeUp, stayCurves } from "@/modules/activities/features/analytics/server/extras";
import { swimmerSpans } from "@/modules/activities/features/analytics/server/swimmers";
import { readLessons } from "@/modules/activities/features/analytics/server/teaching";

let n = 0;
function place(studentId: string, startedOn: string, endOn: string | null, extra: Partial<PlaceRow> = {}): PlaceRow {
  return { id: `p${n++}`, studentId, courseId: "c1", levelId: "l1", programmeId: "pr", clubId: "a", status: endOn ? "WITHDRAWN" : "ACTIVE", startedOn, endOn, scheduledEnd: false, leaveReason: null, inScope: true, dateOfBirth: null, ...extra };
}
const course: CourseRow = { id: "c1", name: null, levelId: "l1", levelName: "Otters", dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, capacity: 4, location: null, clubId: "a", siteName: "Hillview", instructorId: "t1", instructorName: "Ava Example", archived: false };
function lesson(date: string, extra: Partial<LessonRow> = {}): LessonRow {
  return { courseId: "c1", date, startMinutes: 960, durationMinutes: 30, cancelled: false, cancelReason: null, started: true, teacherId: "t1", teacherName: "Ava Example", plannedId: "t1", plannedName: "Ava Example", scheduledName: null, startOffset: 0, expected: 4, marked: 4, present: 4, late: 0, absent: 0, ...extra };
}

test("stay curves count new swimmers still here after each milestone, blank until someone has reached it", () => {
  const curves = stayCurves(swimmerSpans([
    place("s1", "2026-01-05", null), place("s2", "2026-01-12", "2026-02-02"), place("s3", "2026-02-02", "2026-06-01"),
    place("s4", "2026-09-07", null),
  ]), "2026-10-16");
  const winter = curves.cohorts.find(c => c.key === "2026-Q1")!;
  assert.equal(winter.joined, 3);
  assert.deepEqual(winter.values.map(v => v === null ? null : Math.round(v)), [67, 67, 67, 33, null]);
  const autumn = curves.cohorts.find(c => c.key === "2026-Q3")!;
  assert.deepEqual(autumn.values, [100, null, null, null, null]);
});

test("the next four weeks show booked places, with last lessons and moves already made", () => {
  const f = forecast([
    place("s1", "2026-01-05", null), place("s2", "2026-01-05", "2026-10-26", { scheduledEnd: true }),
    place("s3", "2026-10-27", null), place("s4", "2026-01-05", null, { inScope: false, courseId: "x" }),
  ], [course], [], "2026-10-19");
  assert.deepEqual(f.weeks.map(w => [w.date, w.places, w.starting, w.ending]), [
    ["2026-10-19", 2, 0, 0], ["2026-10-26", 1, 0, 1], ["2026-11-02", 2, 1, 0], ["2026-11-09", 2, 0, 0], ["2026-11-16", 2, 0, 0],
  ]);
  assert.equal(f.weeks[0].fill, 50);
});

test("cancelled lessons, the swimmers they affected and why", () => {
  const lessons = readLessons([
    lesson("2026-10-05", { cancelled: true, cancelReason: "Pool closed", expected: 5 }), lesson("2026-10-12"),
    lesson("2026-08-31", { cancelled: true, cancelReason: "No teacher" }),
  ], "2026-10-16", 0);
  const c = cancellations(lessons, { start: "2026-09-21", end: "2026-10-16", previousStart: "2026-08-24", previousEnd: "2026-09-20" });
  assert.deepEqual([c.lessons, c.swimmers, c.previous, c.share], [1, 5, 1, 50]);
  assert.deepEqual(c.reasons, [{ key: "Pool closed", count: 1 }]);
});

test("the same teacher each week is the share taught by the class's most frequent teacher", () => {
  const lessons = readLessons([
    lesson("2026-09-21"), lesson("2026-09-28"), lesson("2026-10-05", { teacherId: "t2", teacherName: "Ben Example" }), lesson("2026-10-12"),
  ], "2026-10-16", 0);
  const c = continuity(lessons, [course], "2026-09-21", "2026-10-16");
  assert.equal(c.school, 75);
  assert.deepEqual([c.classes[0].teachers, c.classes[0].main, c.classes[0].course?.name], [2, "Ava Example", "Otters"]);
});

test("parent app take-up counts swimmers here today with a parent linked", () => {
  const t = parentTakeUp([place("s1", "2026-01-05", null), place("s2", "2026-01-05", null), place("s3", "2026-01-05", "2026-02-02")],
    [{ studentId: "s1", linkedOn: "2026-10-01" }, { studentId: "s3", linkedOn: "2026-01-10" }], "2026-10-16", "2026-09-21", "2026-10-16");
  assert.deepEqual([t.swimmers, t.linked, t.share, t.newLinks], [2, 1, 50, 1]);
});
