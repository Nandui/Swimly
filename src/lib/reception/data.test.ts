import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("Reception authorizes before querying and scopes swimmer and places to the selected club", async () => {
  let authorized = false;
  let query: Record<string, unknown> | undefined;
  const data = serverModule<typeof import("./data")>("src/lib/reception/data.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => "club-a" },
    "@/lib/prisma": { prisma: { student: { findFirst: async (args: Record<string, unknown>) => {
      assert.ok(authorized); query = args; return null;
    } } } },
  });
  assert.equal(await data.getReceptionSwimmer("other-club-swimmer"), null);
  assert.deepEqual(query?.where, { id: "other-club-swimmer", clubId: "club-a" });
  const select = query?.select as { enrolments: { where: unknown }; medicalNotes?: unknown; notes?: unknown; assessmentBookings: { take: number } };
  assert.deepEqual(select.enrolments.where, { status: { in: ["ACTIVE", "WAITLISTED"] }, course: { clubId: "club-a" } });
  assert.equal(select.medicalNotes, true);
  assert.equal(select.notes, true);
  assert.equal(select.assessmentBookings.take, 5);
});

test("an unauthenticated Reception read never reaches the database", async () => {
  const data = serverModule<typeof import("./data")>("src/lib/reception/data.ts", {
    "@/lib/authz": { requireSession: async () => { throw new Error("Not signed in"); } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.fail("Club read before authorization"); } },
    "@/lib/prisma": { prisma: { student: { findFirst: async () => { assert.fail("Unauthenticated query"); } } } },
  });
  await assert.rejects(data.getReceptionSwimmer("swimmer"), /Not signed in/);
});
