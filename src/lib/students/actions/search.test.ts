import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("desk search can include inactive swimmers without widening the current club", async () => {
  let authorized = false;
  const queries: { where: { clubId: string; status?: string }; take: number }[] = [];
  const search = serverModule<typeof import("./search")>("src/lib/students/actions/search.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => "club-a" },
    "@/lib/prisma": { prisma: { student: { findMany: async (query: typeof queries[number]) => {
      assert.ok(authorized);
      queries.push(query);
      return [];
    } } } },
  });

  await search.searchStudents("Example");
  await search.searchStudents("Example", [], true);
  assert.equal(queries[0].where.status, "ACTIVE", "enrolment pickers must keep excluding inactive swimmers");
  assert.equal(queries[1].where.status, undefined);
  assert.ok(queries.every((query) => query.where.clubId === "club-a" && query.take <= 60));
});

test("inactive search still requires authentication before reading any data", async () => {
  const search = serverModule<typeof import("./search")>("src/lib/students/actions/search.ts", {
    "@/lib/authz": { requireSession: async () => { throw new Error("Not signed in"); } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.fail("Unauthenticated club read"); } },
    "@/lib/prisma": { prisma: { student: { findMany: async () => { assert.fail("Unauthenticated swimmer read"); } } } },
  });
  await assert.rejects(search.searchStudents("Example", [], true), /Not signed in/);
});
