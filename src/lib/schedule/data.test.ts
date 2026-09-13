import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { serverModule } from "@/test/server-module";

function fixture(allowed = true) {
  const reads: unknown[] = [];
  const api = serverModule<typeof import("./data")>("src/lib/schedule/data.ts", {
    "@/lib/authz": { requireSession: async () => ({ user: { id: "staff" } }), AuthorizationError: Error, canSee: () => allowed, can: () => false },
    "@/lib/clubs/current": { getCurrentClub: async () => { reads.push("club"); return { club: { id: "site-a", name: "Example Pool" } }; } },
    "@/lib/courses/data/courses": { getCoursesOnDay: async (day: string) => { reads.push(["courses", day]); return [{ id: "course", name: "Example class", _count: { enrolments: 99 } }]; } },
    "@/lib/attendance/data/register": { getRegisterStateForDay: async (day: string, iso: string) => { reads.push(["register", day, iso]); return new Set(["course"]); } },
    "@/lib/attendance/data/cover": { getCoversForDay: async (iso: string) => { reads.push(["covers", iso]); return new Map([["course", { coverByName: "Example Teacher" }]]); } },
    "@/lib/today/assessments": { getTodayAssessments: async (iso: string) => { reads.push(["assessments", iso]); return [{ id: "assessment" }]; } },
    "@/lib/cancellations/data": { getCancellationsForDay: async (iso: string) => { reads.push(["cancellations", iso]); return new Map([["course", { reason: "Pool closure" }]]); } },
    "@/lib/prisma": { prisma: { $queryRaw: async (query: Prisma.Sql) => { reads.push(["places", query.values]); return [{ courseId: "course", enrolled: 4 }]; } } },
  });
  return { ...api, reads };
}

test("every schedule read uses the selected date and availability uses dated places", async () => {
  const f = fixture();
  const data = await f.getSchedule("2026-09-16", new Date("2026-09-13T12:00:00Z"));
  assert.equal(data.iso, "2026-09-16");
  assert.equal(data.todayIso, "2026-09-13");
  assert.ok(f.reads.some(read => JSON.stringify(read) === JSON.stringify(["courses", "WEDNESDAY"])));
  for (const name of ["covers", "assessments", "cancellations"]) assert.ok(f.reads.some(read => JSON.stringify(read) === JSON.stringify([name, "2026-09-16"])));
  assert.ok(f.reads.some(read => JSON.stringify(read) === JSON.stringify(["register", "WEDNESDAY", "2026-09-16"])));
  assert.equal(data.courses[0].enrolled, 4);
  assert.equal(data.courses[0].attendanceTaken, true);
  assert.equal(data.courses[0].cancellation?.reason, "Pool closure");
});

test("ungranted schedule access is refused before any site or session reads", async () => {
  const f = fixture(false);
  await assert.rejects(f.getSchedule("2026-09-16"), /Schedule access/);
  assert.deepEqual(f.reads, []);
});
