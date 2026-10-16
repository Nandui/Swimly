import assert from "node:assert/strict";
import { test } from "node:test";
import type { LessonRow, MarkRow, PlaceRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { customPeriod, periodFrom, reportPeriod, reportQuery, rangeKey } from "@/modules/activities/features/analytics/server/period";
import { activeAt, ageOn, attendanceRisk, movements, retention, swimmerSpans } from "@/modules/activities/features/analytics/server/swimmers";
import { readLessons, teacherStats } from "@/modules/activities/features/analytics/server/teaching";

let n = 0;
function place(studentId: string, startedOn: string, endOn: string | null, extra: Partial<PlaceRow> = {}): PlaceRow {
  return { id: `p${n++}`, studentId, courseId: "c1", levelId: "l1", programmeId: "pr", clubId: "a", status: endOn ? "WITHDRAWN" : "ACTIVE", startedOn, endOn, scheduledEnd: false, leaveReason: null, inScope: true, dateOfBirth: null, ...extra };
}

const now = new Date("2026-10-16T12:00:00Z");
const p13 = reportPeriod("13w", now);

test("the period ends today, starts on a Monday and has a same-length period before it", () => {
  const p = reportPeriod("4w", now);
  assert.equal(p.start, "2026-09-21");
  assert.equal(p.end, "2026-10-16");
  assert.equal(p.previousEnd, "2026-09-20");
  assert.equal(p.previousStart, "2026-08-24");
  assert.deepEqual(p.weeks, ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
  assert.equal(rangeKey("nonsense"), "13w");
  assert.equal(reportQuery({ period: p13, scope: "site" }), "");
  assert.equal(reportQuery({ period: reportPeriod("52w", now), scope: "all", programme: "pr1" }), "?range=52w&sites=all&programme=pr1");
});

test("custom dates: never past today, a same-length comparison, and weeks from the Monday", () => {
  const p = customPeriod("2026-09-03", "2026-09-30", now);
  assert.deepEqual([p.key, p.start, p.end, p.today, p.label, p.current], ["custom", "2026-09-03", "2026-09-30", "2026-09-30", "4 weeks", false]);
  assert.deepEqual([p.previousStart, p.previousEnd], ["2026-08-06", "2026-09-02"]);
  assert.deepEqual(p.weeks, ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
  const late = customPeriod("2026-10-01", "2027-01-01", now);
  assert.deepEqual([late.end, late.current, late.label], ["2026-10-16", true, "16 days"]);
  assert.equal(customPeriod("2020-01-01", "2026-10-16", now).start, "2023-10-15");
  assert.equal(periodFrom({ from: "2026-02-30", to: "2026-03-01", range: "4w" }, now).key, "4w");
  assert.equal(periodFrom({ from: "2026-09-03", to: "2026-09-30" }, now).key, "custom");
  assert.equal(reportQuery({ period: p, scope: "site" }), "?from=2026-09-03&to=2026-09-30");
});

test("moving class or coming back within two weeks is not leaving; a longer gap is", () => {
  const places = [
    place("s1", "2026-01-05", "2026-03-02", { status: "TRANSFERRED" }), place("s1", "2026-03-02", null),
    place("s2", "2026-01-05", "2026-04-06", { leaveReason: "cost" }), place("s2", "2026-04-13", "2026-05-04", { leaveReason: "moving" }),
    place("s3", "2026-02-02", "2026-02-23"), place("s3", "2026-06-01", null),
    place("s4", "2026-02-02", "2026-11-01", { leaveReason: "timing", scheduledEnd: true }),
  ];
  const moves = movements(swimmerSpans(places), "2026-10-16");
  assert.deepEqual(moves.leaves.map(e => [e.studentId, e.date, e.reason]).sort(), [["s2", "2026-05-04", "moving"], ["s3", "2026-02-23", null]]);
  assert.deepEqual(moves.joins.map(e => [e.studentId, e.returning]).sort(), [["s1", false], ["s2", false], ["s3", false], ["s3", true], ["s4", false]]);
  assert.deepEqual(moves.leaving.map(e => e.studentId), ["s4"]);
  assert.equal(Math.round(moves.leaves.find(e => e.studentId === "s2")!.weeks), 17);
});

test("leaving one site for another counts at neither; only the site of the last place records a leaver", () => {
  const places = [place("s1", "2026-01-05", "2026-03-02", { status: "TRANSFERRED" }), place("s1", "2026-03-02", "2026-05-04", { clubId: "b", inScope: false })];
  const moves = movements(swimmerSpans(places), "2026-10-16");
  assert.equal(moves.leaves.length, 0);
  assert.equal(moves.joins.length, 1);
  assert.equal(activeAt(places, "2026-04-01").swimmers.size, 0);
  assert.equal(retention(places, "2026-02-01", "2026-04-01").rate, 100);
});

test("swimmers are counted once however many places they hold", () => {
  const places = [place("s1", "2026-01-05", null), place("s1", "2026-01-05", null, { courseId: "c2" }), place("s2", "2026-01-05", "2026-02-01")];
  const now = activeAt(places, "2026-03-01");
  assert.equal(now.swimmers.size, 1);
  assert.equal(now.places, 2);
  assert.equal(ageOn("2018-10-17", "2026-10-16"), 7);
  assert.equal(ageOn("2018-10-16", "2026-10-16"), 8);
});

const mark = (status: MarkRow["status"], date: string): MarkRow => ({ studentId: "s", courseId: "c", date, status, teacherId: "t", teacherName: "T" });

test("three missed in a row, or under 60% of the last eight, flags a swimmer who may leave", () => {
  assert.deepEqual(attendanceRisk([mark("ABSENT", "3"), mark("ABSENT", "2"), mark("ABSENT", "1"), mark("PRESENT", "0")]).reasons, ["Missed 3 in a row"]);
  assert.deepEqual(attendanceRisk([mark("ABSENT", "5"), mark("PRESENT", "4"), mark("ABSENT", "3"), mark("ABSENT", "2"), mark("PRESENT", "1")]).reasons, ["Came to 2 of last 5"]);
  assert.deepEqual(attendanceRisk([mark("ABSENT", "2"), mark("PRESENT", "1"), mark("LATE", "0")]).reasons, []);
  assert.deepEqual(attendanceRisk([]).reasons, []);
});

const lesson = (date: string, extra: Partial<LessonRow>): LessonRow => ({
  courseId: "c1", date, startMinutes: 960, durationMinutes: 30, cancelled: false, cancelReason: null, started: true,
  teacherId: "ava", teacherName: "Ava", plannedId: "ava", plannedName: "Ava", scheduledName: "Ava", startOffset: 0,
  expected: 4, marked: 4, present: 3, late: 0, absent: 1, ...extra,
});

test("a lesson belongs to who started it; cover, late starts and missed starts are counted", () => {
  const lessons = readLessons([
    lesson("2026-10-05", {}),
    lesson("2026-10-06", { teacherId: "ben", teacherName: "Ben", startOffset: 9 }),
    lesson("2026-10-07", { started: false, teacherId: null, teacherName: null, startOffset: null, marked: 0, present: 0, absent: 0 }),
    lesson("2026-10-08", { cancelled: true }),
    lesson("2026-10-16", { startMinutes: 1200 }),
  ], "2026-10-16", 600);
  assert.equal(lessons[4].finished, false);
  const stats = teacherStats({ lessons, from: "2026-10-01", to: "2026-10-16", studentTeachers: [], ticks: [], completions: [], leaves: [], lastTeacherOf: new Map() });
  const ava = stats.find(t => t.name === "Ava")!, ben = stats.find(t => t.name === "Ben")!;
  assert.equal(ava.lessons, 1);
  assert.equal(ava.missedStarts, 1);
  assert.equal(ben.lessons, 1);
  assert.equal(ben.cover, 1);
  assert.equal(ben.onTime, 0);
  assert.equal(ava.attendance, 75);
});
