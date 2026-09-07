import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("the group read keeps every active level and scopes selected swimmers to the current club", async () => {
  let where: unknown;
  const data = serverModule<typeof import("./together")>("src/lib/together/data/together.ts", {
    "@/lib/authz": { requireSession: async () => ({}) },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/prisma": { prisma: { student: { findMany: async (args: { where: unknown }) => {
      where = args.where;
      return [{ id: "A", firstName: "Sample", lastName: "Swimmer", dateOfBirth: null, contactEmail: null, contactPhone: null,
        enrolments: ["two", "one", "one"].map((id, i) => ({ courseId: String(i), levelId: id, level: { id, name: id, sortOrder: i } })) }];
    } } } },
  });
  const group = await data.getGroup(["A"]);
  assert.deepEqual(where, { id: { in: ["A"] }, clubId: "club" });
  assert.deepEqual(new Set(data.toMembers(group.chosen)[0].levelIds), new Set(["one", "two"]));
  assert.equal(group.chosen[0].levelName, "two, one");
});
