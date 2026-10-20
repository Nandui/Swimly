import assert from "node:assert/strict";
import { test } from "node:test";
import type { CourseRow, PlaceRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { buildClasses, type Dataset } from "@/modules/activities/features/analytics/server/insights";
import { reportPeriod } from "@/modules/activities/features/analytics/server/period";

const def = (id: string, name: string, extra = {}) => ({ id, name, sharedWithId: null, sortOrder: 0, archivedAt: null, ...extra });
const curriculum = {
  programmes: [def("learn", "Learn to swim", { sortOrder: 1 }), def("squad", "Squad", { sortOrder: 2 })],
  levels: [{ ...def("otters", "Otters", { sortOrder: 1 }), programmeId: "learn" }, { ...def("seals", "Seals", { sortOrder: 2 }), programmeId: "learn" }, { ...def("sharks", "Sharks"), programmeId: "squad" }],
  competencies: [],
};
const course = (id: string, levelId: string, startMinutes: number, capacity: number) =>
  ({ id, name: `Class ${id}`, levelId, levelName: levelId, dayOfWeek: "SATURDAY", startMinutes, durationMinutes: 30, capacity, location: null, siteName: "Pool", archived: false }) as unknown as CourseRow;
let n = 0;
const place = (courseId: string, levelId: string) => ({ id: `p${n++}`, studentId: `s${n}`, courseId, levelId, programmeId: "", clubId: "a", status: "ACTIVE", startedOn: "2026-01-05", endOn: null, scheduledEnd: false, leaveReason: null, inScope: true, dateOfBirth: null }) as PlaceRow;

test("a timetable slot opens into its levels, in curriculum order, with their classes", () => {
  const ds = {
    period: reportPeriod("13w", new Date("2026-10-16T12:00:00Z")), minutes: 0,
    courses: [course("a", "seals", 9 * 60, 8), course("b", "otters", 9 * 60 + 30, 6), course("c", "otters", 9 * 60, 6), course("d", "sharks", 10 * 60, 10)],
    places: [place("a", "seals"), place("a", "seals"), place("b", "otters"), place("c", "otters"), place("c", "otters")],
    waitlist: [{ id: "w", studentId: "x", courseId: "b", levelId: "otters", since: "2026-01-01" }],
    lessons: [], studentTeachers: [], marks: [], studentCourses: [], completions: [], ticks: [], results: [], assessments: [], curriculum,
  } as unknown as Dataset;
  const heat = buildClasses(ds).heat;
  assert.deepEqual(heat.map(r => r.start), [9 * 60, 9 * 60 + 30, 10 * 60], "one row per real start time, not per clock hour");
  const nine = heat[0].cells[0];
  assert.deepEqual(nine.levels.map(l => [l.name, l.programmeName, l.enrolled, l.capacity, l.waiting]), [["Otters", "Learn to swim", 2, 6, 0], ["Seals", "Learn to swim", 2, 8, 0]]);
  assert.deepEqual(nine.levels[0].classes.map(c => c.id), ["c"]);
  assert.equal(nine.enrolled, nine.levels.reduce((s, l) => s + l.enrolled, 0));
  assert.deepEqual([heat[1].cells[0].enrolled, heat[1].cells[0].capacity, heat[1].cells[0].waiting], [1, 6, 1]);
});
