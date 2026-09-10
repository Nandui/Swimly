import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarClassHref, calendarSlots, classPhase, filterCalendarClasses, type CalendarClass } from "./calendar";

function course(id: string, startMinutes: number, overrides: Partial<CalendarClass> = {}): CalendarClass {
  return {
    id, name: null, startMinutes, durationMinutes: 30, capacity: 8, enrolled: 6,
    location: "Learner Pool", attendanceTaken: false, cover: null,
    instructorId: "teacher", instructor: { id: "teacher", name: "Alex Example" },
    level: { id: "penguins", name: "Penguins", sortOrder: 1,
      programme: { id: "water", name: "Water Safety & Fun", sortOrder: 0 } },
    ...overrides,
  };
}

test("the full day stays chronological, with exact start times and each class once", () => {
  const courses = [course("late", 1080), course("early", 900), course("quarter", 915), course("parallel", 900)];
  const slots = calendarSlots(courses, 1000);
  assert.deepEqual(slots.map(slot => slot.start), [900, 915, 1080]);
  assert.deepEqual(slots.flatMap(slot => slot.classes.map(c => c.id)), ["early", "parallel", "quarter", "late"]);
  assert.deepEqual(slots.map(slot => slot.phase), ["finished", "finished", "next"]);
  assert.equal(courses[0].id, "late", "sorting does not mutate the source");
});

test("simultaneous classes with different durations keep their own clock boundaries", () => {
  const short = course("short", 900);
  const long = course("long", 900, { durationMinutes: 60 });
  assert.equal(classPhase(short, 899), "later");
  assert.equal(classPhase(short, 900), "running");
  assert.equal(classPhase(short, 930), "finished");
  assert.equal(classPhase(long, 930), "running");
  assert.deepEqual(calendarSlots([short, long, course("next", 960)], 930).map(slot => slot.phase), ["running", "next"]);
  assert.equal(calendarSlots([short, long], 960)[0].phase, "finished");
});

test("pool and instructor filters include today's cover and retain unknown locations", () => {
  const courses = [course("own", 900), course("cover", 930, {
    location: "Lane 2", instructorId: "other", instructor: { id: "other", name: "Sam Example" },
    cover: { coverById: "teacher", coverByName: "Alex Example", instructorName: "Sam Example" },
  }), course("unknown", 960, { location: null, instructorId: null, instructor: null })];
  assert.equal(filterCalendarClasses(courses, "all", "all", "teacher").length, 3);
  assert.deepEqual(filterCalendarClasses(courses, "all", "mine", "teacher").map(c => c.id), ["own", "cover"]);
  assert.deepEqual(filterCalendarClasses(courses, "Lane 2", "teacher", "ignored").map(c => c.id), ["cover"]);
  assert.deepEqual(filterCalendarClasses(courses, "", "all", "teacher").map(c => c.id), ["unknown"]);
  assert.deepEqual(filterCalendarClasses(courses, "Lane 2", "missing", "teacher"), []);
  assert.deepEqual(calendarSlots([], 900), []);
});

test("calendar links respect the separate attendance and class-screen permissions", () => {
  assert.equal(calendarClassHref("c", "2026-09-10", { attendance: true, courses: false }), "/courses/c/class?date=2026-09-10&from=today");
  assert.equal(calendarClassHref("c", "2026-09-10", { attendance: false, courses: true }), "/courses/c");
  assert.equal(calendarClassHref("c", "2026-09-10", { attendance: false, courses: false }), undefined);
});
