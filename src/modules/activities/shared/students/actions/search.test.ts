import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("desk search can include inactive swimmers across all sites", async () => {
  const asked: string[] = [];
  const queries: { where: { clubId?: string; status?: string }; take: number }[] = [];
  const search = serverModule<typeof import("@/modules/activities/shared/students/actions/search")>("src/modules/activities/shared/students/actions/search.ts", {
    "@/lib/authz": { requirePermission: async (permission: string) => { asked.push(permission); } },
    "@/lib/clubs/current": { currentClubId: async () => "club-a" },
    "@/lib/prisma": { prisma: { student: { findMany: async (query: typeof queries[number]) => {
      assert.ok(asked.length > 0);
      queries.push(query);
      return [];
    } } } },
  });

  await search.searchStudents("Example");
  await search.searchStudents("Example", [], true);
  assert.deepEqual(asked, ["swimschool.desk", "swimschool.desk"]);
  assert.equal(queries[0].where.status, "ACTIVE", "enrolment pickers must keep excluding inactive swimmers");
  assert.equal(queries[1].where.status, undefined);
  assert.ok(queries.every((query) => query.where.clubId === undefined && query.take <= 60));
});

test("search refuses anyone without the desk before reading any data", async () => {
  for (const refusal of ["Not signed in", "You do not have permission to do that (swimschool.desk)"]) {
    const search = serverModule<typeof import("@/modules/activities/shared/students/actions/search")>("src/modules/activities/shared/students/actions/search.ts", {
      "@/lib/authz": { requirePermission: async () => { throw new Error(refusal); } },
      "@/lib/clubs/current": { currentClubId: async () => { assert.fail("Unauthorised club read"); } },
      "@/lib/prisma": { prisma: { student: { findMany: async () => { assert.fail("Unauthorised swimmer read"); } } } },
    });
    await assert.rejects(search.searchStudents("Example", [], true), (error: Error) => error.message === refusal);
  }
});
