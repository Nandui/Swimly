import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

/** A teacher planned on the rota for a date takes the class's place that day; planned with nobody
 *  leaves it without one; the usual instructor is kept. Invented classes and people. */
const planned = serverModule<typeof import("@/modules/activities/shared/courses/planned")>("src/modules/activities/shared/courses/planned.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/modules/activities/shared/courses/data/courses": { getCoursesOnDay: async () => [] },
});

test("the date's planned teacher stands in for the usual instructor", () => {
  const rows = [
    { id: "a", instructorId: "tess", instructor: { id: "tess", name: "Tess" } },
    { id: "b", instructorId: "tess", instructor: { id: "tess", name: "Tess" } },
    { id: "c", instructorId: "cole", instructor: { id: "cole", name: "Cole" } },
  ];
  const out = planned.withPlanned(rows, new Map([["a", { teacherId: "cole", teacherName: "Cole" }], ["b", { teacherId: null, teacherName: null }]]));
  assert.deepEqual(out.map((r) => [r.id, r.instructorId, r.instructor?.name ?? null, r.usualInstructorId, r.planned]), [
    ["a", "cole", "Cole", "tess", true],
    ["b", null, null, "tess", true],
    ["c", "cole", "Cole", "cole", false],
  ]);
});
