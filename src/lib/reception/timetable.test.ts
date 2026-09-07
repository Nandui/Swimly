import assert from "node:assert/strict";
import { test } from "node:test";
import { groupReceptionClasses, receptionAvailability, receptionTimeStatus, receptionHref, type ReceptionClass } from "./timetable";

function course(id: string, time: number, level: string, order: number, programme = "swimming"): ReceptionClass {
  return {
    id, name: null, dayOfWeek: "MONDAY", startMinutes: time, durationMinutes: 30,
    capacity: 10, location: "Learner pool", instructor: null, coverName: null,
    level: { id: `${programme}-${level}`, name: level, sortOrder: order,
      programme: { id: programme, name: programme, sortOrder: programme === "swimming" ? 0 : 1 } },
    _count: { enrolments: 3 },
  };
}

test("time grouping orders slots first and parallel classes by curriculum", () => {
  const rows = [course("later", 990, "Stage 1", 0), course("higher", 960, "Stage 2", 1), course("lower", 960, "Stage 1", 0)];
  const groups = groupReceptionClasses(rows, "time");
  assert.deepEqual(groups.map(group => group.title), ["16:00", "16:30"]);
  assert.deepEqual(groups[0].courses.map(row => row.id), ["lower", "higher"]);
  assert.deepEqual(rows.map(row => row.id), ["later", "higher", "lower"]);
});

test("level grouping follows the ladder, keeps programmes distinct and sorts each level by time", () => {
  const rows = [course("other", 960, "Stage 1", 0, "lifesaving"), course("second", 930, "Stage 2", 1),
    course("late", 990, "Stage 1", 0), course("early", 900, "Stage 1", 0)];
  const groups = groupReceptionClasses(rows, "level");
  assert.deepEqual(groups.map(group => group.key), ["swimming-Stage 1", "swimming-Stage 2", "lifesaving-Stage 1"]);
  assert.deepEqual(groups[0].courses.map(row => row.id), ["early", "late"]);
  assert.deepEqual(groupReceptionClasses([], "time"), []);
});

test("swimmer selection and grouping survive navigation without adding arbitrary query keys", () => {
  const url = new URL(receptionHref("swimmer&other=value", "level"), "https://example.test");
  assert.equal(url.searchParams.get("swimmer"), "swimmer&other=value");
  assert.equal(url.searchParams.get("group"), "level");
  assert.equal(url.searchParams.has("other"), false);
  assert.equal(receptionHref(null), "/reception");
});

test("class status includes the starting minute and excludes the ending minute", () => {
  const row = course("lesson", 960, "Stage 1", 0);
  assert.equal(receptionTimeStatus(row, 959, 960), "next");
  assert.equal(receptionTimeStatus(row, 960, 1020), "running");
  assert.equal(receptionTimeStatus(row, 989, 1020), "running");
  assert.equal(receptionTimeStatus(row, 990, 1020), "finished");
  assert.equal(receptionTimeStatus(course("later", 1050, "Stage 2", 1), 960, 1020), "upcoming");
});

test("availability makes full and unlimited classes explicit without negative free places", () => {
  assert.equal(receptionAvailability(9, 10), "9 enrolled · 1 place free");
  assert.equal(receptionAvailability(5, 10), "5 enrolled · 5 places free");
  assert.equal(receptionAvailability(12, 10), "12 enrolled · Full");
  assert.equal(receptionAvailability(4, null), "4 enrolled · No capacity limit");
});
