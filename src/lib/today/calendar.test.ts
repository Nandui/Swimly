import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarAgendaSlots, calendarAssessmentHref, calendarClassHref, calendarProgrammes, calendarSlots, classPhase, filterCalendarAssessments, filterCalendarClasses, type CalendarAssessment, type CalendarClass } from "./calendar";

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

function assessment(id: string, startMinutes: number, overrides: Partial<CalendarAssessment> = {}): CalendarAssessment {
  return { id, startMinutes, durationMinutes: 45, capacity: 6, booked: 2,
    location: "Assessment Pool", programmeName: "Water Safety & Fun", typeName: "Initial assessment",
    instructorId: "assessor", instructor: { id: "assessor", name: "Taylor Example" }, ...overrides };
}

test("the agenda merges assessments and classes at exact times without losing simultaneous sessions", () => {
  const courses = [course("shared-id", 900), course("late", 1080)];
  const assessments = [assessment("next", 945), assessment("shared-id", 900), assessment("early", 840)];
  const slots = calendarAgendaSlots(courses, assessments, 930);
  assert.deepEqual(slots.map(slot => slot.start), [840, 900, 945, 1080]);
  assert.deepEqual(slots.map(slot => slot.phase), ["finished", "running", "next", "later"]);
  assert.deepEqual(slots[1].entries.map(entry => `${entry.kind}-${entry.value.id}`), ["assessment-shared-id", "class-shared-id"]);
  assert.equal(slots.flatMap(slot => slot.entries).length, 5);
  assert.deepEqual(assessments.map(session => session.id), ["next", "shared-id", "early"], "source order is untouched");
});

test("assessment-only days retain finished, running, empty-booking and upcoming sessions", () => {
  const sessions = [assessment("finished", 840), assessment("running", 900, { booked: 0 }), assessment("next", 960)];
  assert.deepEqual(calendarAgendaSlots([], sessions, 930).map(slot => slot.phase), ["finished", "running", "next"]);
  assert.deepEqual(calendarAgendaSlots([], [], 930), []);
});

test("assessment pool and instructor filters use the assigned assessor, including My schedule", () => {
  const sessions = [assessment("mine", 900), assessment("unknown", 930, { location: null, instructorId: null, instructor: null })];
  assert.deepEqual(filterCalendarAssessments(sessions, "all", "mine", "assessor").map(s => s.id), ["mine"]);
  assert.deepEqual(filterCalendarAssessments(sessions, "Assessment Pool", "assessor", "other").map(s => s.id), ["mine"]);
  assert.deepEqual(filterCalendarAssessments(sessions, "", "all", "assessor").map(s => s.id), ["unknown"]);
  assert.deepEqual(filterCalendarAssessments(sessions, "Assessment Pool", "other", "assessor"), []);
  assert.equal(calendarAssessmentHref("session", true), "/assessments/session");
  assert.equal(calendarAssessmentHref("session", false), undefined);
});

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

test("the booking sheet keeps curriculum order and distinct level IDs, not arrival order or names", () => {
  const penguins = course("penguins", 1020);
  const starfish = course("starfish", 1080, {
    level: { ...penguins.level, id: "starfish", name: "Starfish", sortOrder: 0 },
  });
  const other = course("other-programme", 900, {
    level: { ...penguins.level, id: "other-penguins", programme: { id: "other", name: "Other programme", sortOrder: 1 } },
  });
  const groups = calendarProgrammes([other, penguins, starfish]);
  assert.deepEqual(groups.map(group => group.programme.id), ["water", "other"]);
  assert.deepEqual(groups[0].levels.map(row => row.level.id), ["starfish", "penguins"]);
  assert.equal(groups[1].levels[0].level.id, "other-penguins");
  assert.deepEqual(calendarProgrammes([]), []);
});

test("parallel classes share a cell without being overwritten and keep exact times and durations", () => {
  const courses = [course("lane10", 915, { location: "Lane 10", durationMinutes: 60 }),
    course("lane2", 915, { location: "Lane 2" }), course("later", 945)];
  const rows = calendarProgrammes(courses)[0].levels;
  assert.equal(rows.length, 1);
  assert.deepEqual([...rows[0].starts.keys()], [915, 945]);
  assert.deepEqual(rows[0].starts.get(915)?.map(c => [c.id, c.durationMinutes]), [["lane2", 30], ["lane10", 60]]);
  assert.equal([...rows[0].starts.values()].flat().length, courses.length);
  assert.deepEqual(courses.map(c => c.id), ["lane10", "lane2", "later"], "source order stays untouched");
});

test("filtered booking sheets show only relevant levels and retain cover classes", () => {
  const own = course("own", 900);
  const cover = course("cover", 930, { instructorId: "other", location: "Lane 2",
    cover: { coverById: "teacher", coverByName: "Alex Example", instructorName: "Sam Example" },
    level: { ...own.level, id: "starfish", name: "Starfish", sortOrder: 0 },
  });
  const unrelated = course("unrelated", 960, { instructorId: "other",
    level: { ...own.level, id: "turtles", name: "Turtles", sortOrder: 2 },
  });
  const groups = calendarProgrammes(filterCalendarClasses([own, cover, unrelated], "all", "mine", "teacher"));
  assert.deepEqual(groups[0].levels.map(row => row.level.id), ["starfish", "penguins"]);
  assert.equal(groups[0].levels[0].starts.get(930)?.[0].id, "cover");
});
