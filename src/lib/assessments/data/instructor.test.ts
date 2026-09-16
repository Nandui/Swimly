import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("Instructor guards assessment access before reading bookings and constrains site, date and cancellation", async () => {
  const calls: unknown[] = [];
  const { getInstructorAssessmentSession } = serverModule<typeof import("./instructor")>("src/lib/assessments/data/instructor.ts", {
    "@/lib/page-guards": { screenPage: async (...args: unknown[]) => { calls.push(args); } },
    "@/lib/clubs/current": { currentClubId: async () => "selected-site" },
    "@/lib/format": { today: () => "2026-09-16", parseDateOnly: (iso: string) => new Date(`${iso}T00:00:00Z`) },
    "@/lib/authz": { requireSession: async () => { calls.push("authenticated"); } },
    "@/lib/curriculum/data/shared": {},
    "@/lib/curriculum/data/curriculum": {},
    "@/lib/prisma": { prisma: { assessmentSession: { findUnique: async (query: { where: unknown; select: { bookings: unknown } }) => {
      calls.push(query.where);
      assert.ok(query.select.bookings);
      return null;
    } } } },
  });
  assert.equal(await getInstructorAssessmentSession("assessment"), null);
  assert.deepEqual(calls, [["instructor", "assessments.run"], "authenticated", {
    id: "assessment", clubId: "selected-site", date: new Date("2026-09-16T00:00:00Z"), cancelledAt: null,
  }]);
});

test("missing Instructor access or assessment permission never queries the roster", async () => {
  const { getInstructorAssessmentSession } = serverModule<typeof import("./instructor")>("src/lib/assessments/data/instructor.ts", {
    "@/lib/page-guards": { screenPage: async () => { throw Error("Not found"); } },
    "@/lib/clubs/current": { currentClubId: async () => { throw Error("Site must not be read"); } },
    "@/lib/authz": { requireSession: async () => { throw Error("Roster must not be read"); } },
    "@/lib/curriculum/data/shared": {},
    "@/lib/curriculum/data/curriculum": {},
    "@/lib/prisma": { prisma: {} },
  });
  await assert.rejects(getInstructorAssessmentSession("assessment"), /Not found/);
});
