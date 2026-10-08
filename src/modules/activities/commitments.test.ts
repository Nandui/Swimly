import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { Commitment, CommitmentQuery, CommitmentSource } from "@/modules/contributions";

/** The Swim school's classes through the commitments seam: who teaches which
 *  class when (that day's cover, else its instructor), cancelled sessions left
 *  out, filtered by site or person. Invented classes and people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let list: (q: CommitmentQuery) => Promise<Commitment[]>;
let plan: NonNullable<CommitmentSource["plan"]>;
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
  const sources: CommitmentSource[] = [];
  serverModule("src/modules/activities/contributions.ts", {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "@/lib/authz": { requireSession: async () => ({ user: {} }), requirePermission: async () => ({ user: {} }), AuthorizationError: class extends Error {} },
    "@/lib/clubs/current": { currentClubId: async () => "club_churchfield", currentClubIdIfAny: async () => "club_churchfield" },
    "@/lib/audit": { logAudit: async () => {} },
    "@/lib/directory": { staffByIds: async (ids: string[]) => new Map(ids.filter((id) => ["tess", "cole"].includes(id)).map((id) => [id, { id, name: id }])) },
    "@/modules/contributions": { registerAreaRename() {}, registerCommitments: (s: (typeof sources)[number]) => sources.push(s), registerHomeCard() {}, registerSiteSummary() {} },
    react: { cache: <T,>(fn: T) => fn },
    "next/navigation": { notFound() { throw new Error("not found"); }, redirect() { throw new Error("redirect"); } },
  });
  const classes = sources.find((s) => s.id === "activities.classes")!;
  list = classes.list;
  plan = classes.plan!;
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

test("a teacher planned on the rota teaches that date; the usual instructor clears the plan", async () => {
  const by = { id: "tess", name: "tess" };
  const MON2 = "2026-10-19";
  assert.deepEqual(await plan({ ref: "seam-mon", siteId: "club_churchfield", date: MON2, userId: "cole", by }), { ok: true });
  let day = await list({ siteIds: ["club_churchfield"], from: MON2, to: MON2 });
  assert.deepEqual(day.map((c) => [c.userId, c.ref, c.planned]), [["cole", "seam-mon", true]]);
  assert.deepEqual((await list({ userIds: ["cole"], from: MON2, to: MON2 })).map((c) => c.date), [MON2], "found by the planned teacher");
  assert.deepEqual(await plan({ ref: "seam-mon", siteId: "club_churchfield", date: MON2, userId: null, by }), { ok: true });
  day = await list({ siteIds: ["club_churchfield"], from: MON2, to: MON2 });
  assert.deepEqual(day.map((c) => [c.userId, c.planned]), [[null, true]], "planned with nobody is a gap");
  await plan({ ref: "seam-mon", siteId: "club_churchfield", date: MON2, userId: "tess", by });
  day = await list({ siteIds: ["club_churchfield"], from: MON2, to: MON2 });
  assert.deepEqual(day.map((c) => [c.userId, c.planned]), [["tess", false]], "back to the usual instructor, no plan kept");
});

test("a class that has started, is cancelled or does not run that day cannot be planned", async () => {
  const by = { id: "tess", name: "tess" };
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_churchfield", date: NEXT, userId: "tess", by })).ok, false, "started: the register holds it");
  assert.equal((await plan({ ref: "seam-tue", siteId: "club_churchfield", date: "2026-10-06", userId: "cole", by })).ok, false, "cancelled");
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_churchfield", date: "2026-10-20", userId: "cole", by })).ok, false, "a Tuesday");
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_bishopstown", date: MON, userId: "cole", by })).ok, false, "another site");
});
