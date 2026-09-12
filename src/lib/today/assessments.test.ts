import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Query = {
  where: { clubId: string; date: Date; cancelledAt: null };
  select: Record<string, unknown>;
};

function subject(findMany: (query: Query) => Promise<unknown[]>, requireSession = async () => ({})) {
  return serverModule<typeof import("./assessments")>("src/lib/today/assessments.ts", {
    "@/lib/authz": { requireSession },
    "@/lib/clubs/current": { currentClubId: async () => "current-site" },
    "@/lib/prisma": { prisma: { assessmentSession: { findMany } } },
    "@/lib/curriculum/data/shared": { getSharedCurriculum: async () => ({
      programme: (id: string) => id === "legacy-programme" ? { name: "Shared programme" } : undefined,
      types: [{ id: "shared-type", name: "Shared assessment" }],
      typeIds: { resolve: (id: string) => id === "legacy-type" ? "shared-type" : id },
    }) },
  });
}

test("Today queries only the current site's dated, non-cancelled sessions and seat-holding counts", async () => {
  const { getTodayAssessments } = subject(async query => {
    assert.deepEqual(query.where, { clubId: "current-site", date: new Date("2026-09-12T00:00:00.000Z"), cancelledAt: null });
    assert.deepEqual(Object.keys(query.select).sort(), ["_count", "capacity", "durationMinutes", "id", "instructor", "instructorId", "location", "programme", "startMinutes", "type"]);
    assert.deepEqual(query.select._count, { select: { bookings: { where: { status: { in: ["BOOKED", "ATTENDED"] } } } } });
    return [{ id: "assessment", startMinutes: 600, durationMinutes: 30, location: "Learner Pool", capacity: 6,
      instructorId: null, instructor: null, programme: { id: "legacy-programme", name: "Old programme" },
      type: { id: "legacy-type", name: "Old type" }, _count: { bookings: 0 } }];
  });
  assert.deepEqual(await getTodayAssessments("2026-09-12"), [{ id: "assessment", startMinutes: 600,
    durationMinutes: 30, location: "Learner Pool", capacity: 6, instructorId: null, instructor: null,
    programmeName: "Shared programme", typeName: "Shared assessment", booked: 0 }]);
});

test("legacy sessions without a type or capacity remain visible with safe fallbacks", async () => {
  const { getTodayAssessments } = subject(async () => [{ id: "legacy", startMinutes: 720, durationMinutes: 60,
    location: null, capacity: null, instructorId: null, instructor: null,
    programme: { id: "other", name: "Original programme" }, type: null, _count: { bookings: 3 } }]);
  const [session] = await getTodayAssessments("2026-09-12");
  assert.equal(session.programmeName, "Original programme");
  assert.equal(session.typeName, null);
  assert.equal(session.capacity, null);
  assert.equal(session.booked, 3);
});

test("missing sessions and invalid dates return an empty schedule; authentication precedes querying", async () => {
  let calls = 0;
  const { getTodayAssessments } = subject(async () => { calls++; return []; });
  assert.deepEqual(await getTodayAssessments("not-a-date"), []);
  assert.equal(calls, 0);
  assert.deepEqual(await getTodayAssessments("2026-09-12"), []);
  assert.equal(calls, 1);
  const denied = subject(async () => { throw Error("Database must not be reached"); }, async () => { throw Error("Sign in required"); });
  await assert.rejects(() => denied.getTodayAssessments("2026-09-12"), /Sign in required/);
});
