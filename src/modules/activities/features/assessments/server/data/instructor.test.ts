import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import * as format from "@/lib/format";

test("Instructor guards assessment access before reading bookings and constrains site, date and cancellation", async () => {
  const calls: unknown[] = [];
  const { getInstructorAssessmentSession } = serverModule<typeof import("@/modules/activities/features/assessments/server/data/instructor")>("src/modules/activities/features/assessments/server/data/instructor.ts", {
    "@/lib/page-guards": { screenPage: async (...args: unknown[]) => { calls.push(args); } },
    "@/lib/clubs/current": { currentClubId: async () => "selected-site" },
    "@/lib/format": { ...format, today: () => "2026-09-16", parseDateOnly: (iso: string) => new Date(`${iso}T00:00:00Z`) },
    "@/lib/authz": { requireSession: async () => { calls.push("authenticated"); return { user: { id: "staff", permissions: ["students.manage", "attendance.mark"], screens: ["students", "courses", "instructor"] } }; } },
    "@/modules/activities/shared/curriculum/data/shared": {},
    "@/modules/activities/shared/curriculum/data/curriculum": {},
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
  const { getInstructorAssessmentSession } = serverModule<typeof import("@/modules/activities/features/assessments/server/data/instructor")>("src/modules/activities/features/assessments/server/data/instructor.ts", {
    "@/lib/page-guards": { screenPage: async () => { throw Error("Not found"); } },
    "@/lib/clubs/current": { currentClubId: async () => { throw Error("Site must not be read"); } },
    "@/lib/authz": { requireSession: async () => { throw Error("Roster must not be read"); } },
    "@/modules/activities/shared/curriculum/data/shared": {},
    "@/modules/activities/shared/curriculum/data/curriculum": {},
    "@/lib/prisma": { prisma: {} },
  });
  await assert.rejects(getInstructorAssessmentSession("assessment"), /Not found/);
});
