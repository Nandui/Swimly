import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("class inspection authorizes before reads and confines the roster to the current club", async () => {
  let authorized = false;
  const data = serverModule<typeof import("./courses")>("src/lib/courses/data/courses.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.ok(authorized); return "club-a"; } },
    "@/lib/prisma": { prisma: { enrolment: { findMany: async (args: { where: unknown; select: Record<string, unknown> }) => {
      assert.ok(authorized);
      assert.deepEqual(args.where, { courseId: "class", course: { clubId: "club-a" }, student: { clubId: "club-a" }, status: { in: ["ACTIVE", "WAITLISTED"] } });
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
  await assert.rejects(data.getCourse("class"), /Not signed in/);
});
