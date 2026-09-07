import assert from "node:assert/strict";
import { test } from "node:test";
import type { CourseRow } from "@/lib/courses/data/courses";
import { findCombinations, findTimesTogether, type FamilyMember, type Placement } from "./match";

function course(id: string, levelId = "one", startMinutes = 960, free = 1): CourseRow {
  return { id, clubId: "club", club: { id: "club", name: "Club" }, name: id,
    dayOfWeek: "MONDAY", startMinutes, durationMinutes: 30, capacity: free,
    location: null, archivedAt: null, levelId, instructorId: null, instructor: null,
    level: { id: levelId, name: levelId, sortOrder: 0, programme: { id: "programme", name: "Swimming", sortOrder: 0 } },
    _count: { enrolments: 0 } };
}
function member(id: string, levelIds = ["one"], currentCourseIds: string[] = []): FamilyMember {
  return { studentId: id, name: id, levelIds, currentCourseIds };
}
const keys = (rows: Placement[][]) => rows.map((row) => row.map((p) => p.course.id).join(",")).sort();
function everyPage(members: FamilyMember[], courses: CourseRow[], differentTimes = false, limit = 2) {
  const all: Placement[][] = [];
  let after: string[] | null = null;
  do {
    const page = findCombinations(members, courses, { after, limit, differentTimes });
    all.push(...page.combinations);
    after = page.next;
    assert.ok(all.length < 10000, "pagination must make progress");
  } while (after);
  return all;
}

test("all parallel class assignments remain reachable, including sibling swaps", () => {
  const courses = [course("a"), course("b"), course("c")];
  assert.deepEqual(keys(everyPage([member("A"), member("B")], courses)),
    ["a,b", "a,c", "b,a", "b,c", "c,a", "c,b"]);
});

test("existing places are retained as options without hiding alternatives or double counting seats", () => {
  const full = { ...course("full"), _count: { enrolments: 1 } };
  const rows = everyPage([member("A", ["one"], ["full"]), member("B")], [full, course("new", "one", 960, 2)]);
  assert.deepEqual(keys(rows), ["full,new", "new,new"]);
  assert.equal(rows.find((row) => row[0].course.id === "full")![0].alreadyIn, true);
});

test("every current level is considered and constrained swimmers still get a seat", () => {
  const rows = everyPage([member("A", ["one", "two"]), member("B")], [course("a"), course("b", "two")]);
  assert.deepEqual(keys(rows), ["b,a"]);
});

test("a current place survives a class level rename; no new swimmer gets the full seat", () => {
  const changed = { ...course("a", "two", 960, 1), _count: { enrolments: 1 } };
  assert.equal(findTimesTogether([member("A", ["one"], ["a"])], [changed]).days.length, 1);
  assert.equal(findTimesTogether([member("B")], [changed]).days.length, 0);
});

test("different-time combinations are included even on days with exact matches", () => {
  const members = [member("A"), member("B", ["two"])];
  const courses = [course("a"), course("b", "two"), course("c", "two", 990)];
  const result = findTimesTogether(members, courses);
  assert.equal(result.days[0].together.length, 1);
  assert.ok(result.days[0].spread);
  assert.deepEqual(keys(everyPage(members, result.days[0].spread!, true)), ["a,c"]);
});

test("unknown levels never produce an apparently complete group result", () => {
  const result = findTimesTogether([member("A"), member("B", [])], [course("a")]);
  assert.deepEqual(result.days, []);
  assert.deepEqual(result.unplaced.map((m) => m.studentId), ["B"]);
});

test("archived, full and different-day classes cannot produce a false match; uncapped classes can", () => {
  const members = [member("A"), member("B", ["two"])];
  assert.deepEqual(findTimesTogether(members, [course("a"), { ...course("b", "two"), dayOfWeek: "TUESDAY" }]).days, []);
  assert.deepEqual(findTimesTogether([member("A")], [{ ...course("a"), archivedAt: new Date() }, course("b", "one", 960, 0)]).days, []);
  assert.equal(findCombinations([member("A"), member("B")], [{ ...course("a"), capacity: null }]).combinations.length, 1);
});

test("paginated matching agrees with exhaustive capacity checks across 250 synthetic timetables", () => {
  let seed = 7349;
  const random = (n: number) => { seed = (seed * 1664525 + 1013904223) >>> 0; return Math.floor(seed / 0x100000000 * n); };
  for (let scenario = 0; scenario < 250; scenario++) {
    const courses = Array.from({ length: 4 }, (_, i) => course(String(i), String(random(2)), 960 + 30 * random(2), random(3)));
    const members = Array.from({ length: 3 }, (_, i) => member(String(i), random(3) === 0 ? ["0", "1"] : [String(random(2))], random(3) === 0 ? [String(random(4))] : []));
    const expected: Placement[][] = [];
    for (const a of courses) for (const b of courses) for (const c of courses) {
      const assignment = [a, b, c].map((row, i) => ({ studentId: members[i].studentId, name: members[i].name, course: row, alreadyIn: members[i].currentCourseIds.includes(row.id) }));
      if (assignment.some((p, i) => !p.alreadyIn && !members[i].levelIds.includes(p.course.levelId))) continue;
      if (courses.some((row) => assignment.filter((p) => !p.alreadyIn && p.course.id === row.id).length > row.capacity!)) continue;
      expected.push(assignment);
    }
    for (const differentTimes of [false, true]) {
      const filtered = expected.filter((row) => !differentTimes || new Set(row.map((p) => p.course.startMinutes)).size > 1);
      assert.deepEqual(keys(everyPage(members, courses, differentTimes, 1 + random(5))), keys(filtered), `scenario ${scenario}, spread ${differentTimes}`);
    }
  }
});

test("large families can start and continue a large result set without enumerating it all", () => {
  const members = Array.from({ length: 8 }, (_, i) => member(String(i)));
  const courses = Array.from({ length: 30 }, (_, i) => course(String(i), "one", 960, 8));
  const first = findCombinations(members, courses);
  assert.equal(first.combinations.length, 5);
  assert.ok(first.next);
  const second = findCombinations(members, courses, { after: first.next });
  assert.equal(second.combinations.length, 5);
  assert.ok(keys(second.combinations).every((key) => !keys(first.combinations).includes(key)));
  assert.deepEqual(findCombinations(members, courses, { differentTimes: true }).combinations, []);
});

