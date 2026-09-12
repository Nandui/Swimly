import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("class inspection authorizes before reads and reads a class roster regardless of registration site", async () => {
  let authorized = false;
  const data = serverModule<typeof import("./courses")>("src/lib/courses/data/courses.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.ok(authorized); return "club-a"; } },
    "@/lib/prisma": { prisma: { programme: { findMany: async () => [] }, enrolment: { findMany: async (args: { where: unknown; select: Record<string, unknown> }) => {
      assert.ok(authorized);
      assert.deepEqual(args.where, { courseId: "class", status: { in: ["ACTIVE", "WAITLISTED"] } });
      assert.deepEqual(args.select.programme, { select: { id: true, name: true } });
      assert.deepEqual(args.select.level, { select: { id: true, name: true } });
      assert.equal((args.select.student as { select: { memberNumber: boolean } }).select.memberNumber, true);
      return [];
    } } } },
  });
  assert.deepEqual(await data.getRoster("class"), []);
});

test("unauthenticated class reads never query the database or selected club", async () => {
  const data = serverModule<typeof import("./courses")>("src/lib/courses/data/courses.ts", {
    "@/lib/authz": { requireSession: async () => { throw new Error("Not signed in"); } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.fail("Club read before authorization"); } },
    "@/lib/prisma": { prisma: {} },
  });
  await assert.rejects(data.getRoster("class"), /Not signed in/);
  await assert.rejects(data.getCourses(true), /Not signed in/);
  await assert.rejects(data.getCourses(true, true), /Not signed in/);
  await assert.rejects(data.getCourse("class"), /Not signed in/);
});

test("the all-site directory retains historical levels while enrolment pickers require live curriculum", async () => {
  let authorized = false;
  const queries: Record<string, unknown>[] = [];
  const rows = [{ id: "live", levelId: "live", clubId: "club-a" }, { id: "historic", levelId: "retired", clubId: "club-b" }];
  const data = serverModule<typeof import("./courses")>("src/lib/courses/data/courses.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.fail("All-site directory must not narrow to the working site"); } },
    "@/lib/curriculum/data/shared": { getSharedCurriculum: async () => ({}), sharedCourse: (row: unknown) => row, liveSharedLevel: (_: unknown, id: string) => id === "live" },
    "@/lib/prisma": { prisma: { course: { findMany: async ({ where }: { where: Record<string, unknown> }) => { assert.ok(authorized); queries.push(where); return rows; } } } },
  });
  assert.deepEqual((await data.getCourses(true, true)).map(c => c.id), ["live", "historic"]);
  assert.deepEqual((await data.getCourses(false, true)).map(c => c.id), ["live"]);
  assert.deepEqual(queries[0], { club: { archivedAt: null } });
  assert.deepEqual(queries[1], { club: { archivedAt: null }, archivedAt: null });
});
