import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { Commitment, CommitmentQuery } from "@/modules/contributions";

/** The Swim school's classes through the commitments seam: who teaches which
 *  class when (that day's cover, else its instructor), cancelled sessions left
 *  out, filtered by site or person. Invented classes and people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let list: (q: CommitmentQuery) => Promise<Commitment[]>;
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
// 5 October 2026 is a Monday.
const MON = "2026-10-05", NEXT = "2026-10-12";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-teach", name: "Teacher", permissions: [], screens: [] } });
  for (const id of ["tess", "cole"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-teach", orgId: "org_leisureworld" } });
  await db.programme.create({ data: { id: "seam-programme", clubId: "club_churchfield", name: "Synthetic swimming" } });
  await db.level.create({ data: { id: "seam-level", programmeId: "seam-programme", name: "Turtles" } });
  await db.course.create({ data: { id: "seam-mon", clubId: "club_churchfield", levelId: "seam-level", dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 45, instructorId: "tess", location: "Learner pool" } });
  await db.course.create({ data: { id: "seam-tue", clubId: "club_churchfield", levelId: "seam-level", dayOfWeek: "TUESDAY", startMinutes: 1020, durationMinutes: 30, instructorId: "tess" } });
  await db.classCover.create({ data: { courseId: "seam-mon", date: date(NEXT), coverById: "cole", coverByName: "cole", instructorId: "tess", instructorName: "tess" } });
  await db.classCancellation.create({ data: { courseId: "seam-tue", clubId: "club_churchfield", date: date("2026-10-06"), className: "Turtles", levelName: "Turtles", programmeName: "Synthetic swimming", startMinutes: 1020, durationMinutes: 30,
    reason: "Synthetic pool closure", cancelledById: "tess", cancelledByName: "tess" } });
  const sources: { id: string; list: typeof list }[] = [];
  serverModule("src/modules/activities/contributions.ts", {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "@/lib/authz": { requireSession: async () => ({ user: {} }), requirePermission: async () => ({ user: {} }), AuthorizationError: class extends Error {} },
    "@/lib/clubs/current": { currentClubId: async () => "club_churchfield", currentClubIdIfAny: async () => "club_churchfield" },
    "@/modules/contributions": { registerCommitments: (s: (typeof sources)[number]) => sources.push(s), registerHomeCard() {}, registerSiteSummary() {}, registerStaffColumn() {} },
    react: { cache: <T,>(fn: T) => fn },
    "next/navigation": { notFound() { throw new Error("not found"); }, redirect() { throw new Error("redirect"); } },
  });
  list = sources.find((s) => s.id === "activities.classes")!.list;
});
after(async () => { await fixture?.close(); });

test("each class on each date, taught by that day's cover or its instructor; cancelled sessions left out", async () => {
  const week = await list({ siteIds: ["club_churchfield"], from: MON, to: "2026-10-11" });
  assert.deepEqual(week.map((c) => [c.date, c.userId, c.startMinutes, c.endMinutes, c.label]), [["2026-10-05", "tess", 960, 1005, "Turtles, Learner pool"]], "Tuesday's is cancelled");
  const next = await list({ siteIds: ["club_churchfield"], from: NEXT, to: "2026-10-13" });
  assert.deepEqual(next.map((c) => [c.date, c.userId]), [[NEXT, "cole"], ["2026-10-13", "tess"]], "covered by cole on the 12th");
});

test("by person: only the classes they teach that day; another site has none", async () => {
  assert.deepEqual((await list({ userIds: ["cole"], from: MON, to: "2026-10-18" })).map((c) => c.date), [NEXT]);
  assert.deepEqual((await list({ userIds: ["tess"], from: NEXT, to: NEXT })), [], "cole covers it that day");
  assert.deepEqual(await list({ siteIds: ["club_bishopstown"], from: MON, to: "2026-10-11" }), []);
});
