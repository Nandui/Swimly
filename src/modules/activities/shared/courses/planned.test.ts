import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

/** The rota's Plan names each class's teacher for a date; planned with nobody leaves it without
 *  one. Up to the grace day a class nothing is planned for keeps its stored instructor; after it
 *  it has none. The stored instructor is kept. Invented classes and people. */
const planned = serverModule<typeof import("@/modules/activities/shared/courses/planned")>("src/modules/activities/shared/courses/planned.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/modules/activities/shared/courses/data/courses": { getCoursesOnDay: async () => [] },
});

const rows = [
  { id: "a", instructorId: "tess", instructor: { id: "tess", name: "Tess" } },
  { id: "b", instructorId: "tess", instructor: { id: "tess", name: "Tess" } },
  { id: "c", instructorId: "cole", instructor: { id: "cole", name: "Cole" } },
];
const plan = new Map([["a", { teacherId: "cole", teacherName: "Cole" }], ["b", { teacherId: null, teacherName: null }]]);
const view = (iso: string) => planned.withPlanned(rows, plan, iso).map((r) => [r.id, r.instructorId, r.instructor?.name ?? null, r.usualInstructorId, r.planned]);

test("during the grace the date's planned teacher stands in for the stored instructor", () => {
  assert.deepEqual(view(planned.USUAL_INSTRUCTOR_UNTIL), [
    ["a", "cole", "Cole", "tess", true],
    ["b", null, null, "tess", true],
    ["c", "cole", "Cole", "cole", false],
  ]);
});

test("after the grace only the Plan names a class's teacher", () => {
  assert.deepEqual(view("2026-11-02"), [
    ["a", "cole", "Cole", "tess", true],
    ["b", null, null, "tess", true],
    ["c", null, null, "cole", false],
  ]);
  assert.equal(planned.dayTeacherId("cole", undefined, "2026-11-02"), null);
  assert.equal(planned.dayTeacherId("cole", undefined, "2026-11-01"), "cole");
  assert.equal(planned.dayTeacherId("cole", { teacherId: "tess", teacherName: "Tess" }, "2026-11-02"), "tess");
});
