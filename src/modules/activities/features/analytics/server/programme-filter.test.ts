import assert from "node:assert/strict";
import { test } from "node:test";
import { forProgramme, programmeOptions } from "@/modules/activities/features/analytics/server/programme-filter";
import type { CourseRow, PlaceRow } from "@/modules/activities/features/analytics/server/insight-queries";

const def = (id: string, name: string, extra = {}) => ({ id, name, sharedWithId: null, sortOrder: 0, archivedAt: null, ...extra });
const curriculum = {
  programmes: [def("learn", "Learn to swim", { sortOrder: 1 }), def("squad", "Squad", { sortOrder: 2 }), def("learn-copy", "Learn to swim", { sharedWithId: "learn" }), def("old", "Old", { archivedAt: new Date() })],
  levels: [{ ...def("otters", "Otters"), programmeId: "learn-copy" }, { ...def("sharks", "Sharks"), programmeId: "squad" }],
  competencies: [{ ...def("float", "Float"), levelId: "otters" }, { ...def("dive", "Dive"), levelId: "sharks" }],
};
const place = (id: string, levelId: string, courseId: string) => ({ id, studentId: id, courseId, levelId, programmeId: "", clubId: "a", status: "ACTIVE", startedOn: "2026-01-05", endOn: null, scheduledEnd: false, leaveReason: null, inScope: true, dateOfBirth: null }) as PlaceRow;
const course = (id: string, levelId: string) => ({ id, levelId }) as CourseRow;

test("only live shared programmes are offered, in their order", () => {
  assert.deepEqual(programmeOptions(curriculum).map(p => p.id), ["learn", "squad"]);
});

test("one programme keeps its classes, places, lessons, passes and skills, through site copies", () => {
  const ds = {
    places: [place("a", "otters", "c1"), place("b", "sharks", "c2")], waitlist: [{ id: "w", studentId: "c", courseId: "c2", levelId: "sharks", since: "2026-01-01" }],
    courses: [course("c1", "otters"), course("c2", "sharks")], lessons: [{ courseId: "c1" }, { courseId: "c2" }],
    studentTeachers: [], marks: [], studentCourses: [],
    completions: [{ studentId: "a", levelId: "otters", completedOn: "2026-02-01", confirmedById: null, confirmedByName: "", override: false }],
    ticks: [{ studentId: "b", competencyId: "dive", assessedOn: "2026-02-01", assessedById: null, assessedByName: "", courseId: "c2" }],
    results: [], assessments: [{ sessionId: "s", date: "2026-02-01", sessionCancelled: false, status: "ATTENDED", studentId: "x", outcomeLevelId: "sharks" }],
    curriculum,
  };
  const learn = forProgramme(ds, "learn");
  assert.deepEqual([learn.places.length, learn.courses.length, learn.lessons.length, learn.waitlist.length, learn.completions.length, learn.ticks.length, learn.assessments.length], [1, 1, 1, 0, 1, 0, 0]);
  assert.equal(forProgramme(ds, null), ds);
});
