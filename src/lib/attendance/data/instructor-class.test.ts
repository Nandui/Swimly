import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

function fixture(owner: string | null | undefined, cancelled = false) {
  const reads: string[] = [];
  const data = serverModule<typeof import("./instructor-class")>(
    "src/lib/attendance/data/instructor-class.ts",
    {
      "@/lib/cancellations/data": { getCancellation: async () => cancelled ? { id: "cancelled", reason: "Pool closed" } : null },
      "@/lib/page-guards": {
        classPage: async () => ({ user: { id: "teacher" } }),
      },
      "@/lib/courses/data/courses": {
        getCourse: async () => ({
          id: "class",
          clubId: "site",
          dayOfWeek: "FRIDAY",
          archivedAt: null,
        }),
      },
      "@/lib/clubs/current": {
        getCurrentClub: async () => ({ club: { id: "site" } }),
      },
      "@/lib/attendance/data/cover": {
        getClassCover: async () =>
          owner === undefined
            ? null
            : { coverById: owner, coverByName: "Teacher" },
      },
      "@/lib/attendance/data/register": {
        getRegister: async () => {
          reads.push("attendance");
          return {};
        },
      },
      "@/lib/progression/data/progress": {
        getClassProgress: async () => {
          reads.push("competencies");
          return {};
        },
      },
    },
  );
  return { data, reads };
}

test("cancelled sessions never load the roster even for their confirmed teacher", async () => {
  const f = fixture("teacher", true);
  assert.equal((await f.data.getInstructorClass("class", "2026-09-11"))?.state, "cancelled");
  assert.deepEqual(f.reads, []);
});
test("unstarted classes still require confirmation before loading swimmer records", async () => {
  const f = fixture(undefined);
  assert.equal((await f.data.getInstructorClass("class", "2026-09-11"))?.state, "available");
  assert.deepEqual(f.reads, []);
});
test("existing starts open the roster for colleagues, including starts by deleted accounts", async () => {
  for (const owner of ["teacher", "other", null]) {
    const f = fixture(owner);
    assert.equal((await f.data.getInstructorClass("class", "2026-09-11"))?.state, "ready");
    assert.deepEqual(f.reads.sort(), ["attendance", "competencies"]);
  }
});
