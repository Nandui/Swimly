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
  const select = query?.select as { enrolments: { where: unknown; select: { level: unknown; programme: unknown } }; medicalNotes?: unknown; contacts?: unknown };
  assert.deepEqual(select.enrolments.where, { status: { in: ["ACTIVE", "WAITLISTED"] }, course: { clubId: "club-a" } });
  assert.equal(select.medicalNotes, undefined);
  assert.equal(select.contacts, undefined);
  assert.deepEqual(select.enrolments.select.level, { select: { id: true, name: true } });
  assert.deepEqual(select.enrolments.select.programme, { select: { id: true, name: true } });
});

test("an unauthenticated Reception read never reaches the database", async () => {
  const data = serverModule<typeof import("./data")>("src/lib/reception/data.ts", {
    "@/lib/authz": { requireSession: async () => { throw new Error("Not signed in"); } },
    "@/lib/clubs/current": { currentClubId: async () => { assert.fail("Club read before authorization"); } },
    "@/lib/prisma": { prisma: { student: { findFirst: async () => { assert.fail("Unauthenticated query"); } } } },
  });
  await assert.rejects(data.getReceptionSwimmer("swimmer"), /Not signed in/);
  await assert.rejects(data.getReceptionClassOptions(), /Not signed in/);
});

test("weekly class options authorize, scope club/curriculum and count only active seats", async () => {
  let authorized = false;
  const data = serverModule<typeof import("./data")>("src/lib/reception/data.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/clubs/current": { currentClubId: async () => "club-a" },
    "@/lib/prisma": { prisma: { course: { findMany: async (args: { where: unknown; select: Record<string, unknown> }) => {
      assert.ok(authorized);
      assert.deepEqual(args.where, { clubId: "club-a", archivedAt: null, level: { archivedAt: null, programme: { archivedAt: null } } });
      assert.deepEqual(args.select._count, { select: { enrolments: { where: { status: "ACTIVE" } } } });
      assert.equal(args.select.enrolments, undefined);
      return [];
    } } } },
  });
  assert.deepEqual(await data.getReceptionClassOptions(), []);
});
