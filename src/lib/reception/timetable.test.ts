import assert from "node:assert/strict";
import { test } from "node:test";
import { groupReceptionClasses, receptionHref, type ReceptionClass } from "./timetable";

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
