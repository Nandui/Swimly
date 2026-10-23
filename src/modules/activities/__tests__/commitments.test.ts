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
let planMany: NonNullable<CommitmentSource["planMany"]>;
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
  serverModule("src/modules/activities/module.ts", {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "@/lib/authz": { requireSession: async () => ({ user: {} }), requirePermission: async () => ({ user: {} }), AuthorizationError: class extends Error {} },
    "@/lib/clubs/current": { currentClubId: async () => "club_churchfield", currentClubIdIfAny: async () => "club_churchfield" },
    "@/lib/audit": { logAudit: async () => {} },
    "@/lib/directory": { staffByIds: async (ids: string[]) => new Map(ids.filter((id) => ["tess", "cole"].includes(id)).map((id) => [id, { id, name: id }])),
      activeStaffIds: async (ids: string[]) => new Set(ids.filter((id) => ["tess", "cole"].includes(id))) },
    "@/modules/contributions": { registerAreaRename() {}, registerCommitments: (s: (typeof sources)[number]) => sources.push(s), registerHomeCard() {}, registerMemberDirectory() {}, registerSiteSummary() {} },
    react: { cache: <T,>(fn: T) => fn },
    "next/navigation": { notFound() { throw new Error("not found"); }, redirect() { throw new Error("redirect"); } },
  });
  const classes = sources.find((s) => s.id === "activities.classes")!;
  list = classes.list;
  plan = classes.plan!;
  planMany = classes.planMany!;
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

test("a teacher planned on the rota teaches that date; the plan is kept whoever it names", async () => {
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
  assert.deepEqual(day.map((c) => [c.userId, c.planned]), [["tess", true]], "the stored instructor chosen on the Plan is a plan too");
});

test("after the grace day only the Plan names a class's teacher", async () => {
  // Owner decision, 16 October 2026 (two weeks' grace): from 2 November a class nothing is
  // planned for has no teacher, whatever instructor is stored on it.
  const by = { id: "tess", name: "tess" };
  const LATER = "2026-11-02";
  let day = await list({ siteIds: ["club_churchfield"], from: LATER, to: LATER });
  assert.deepEqual(day.map((c) => [c.ref, c.userId, c.planned]), [["seam-mon", null, false]]);
  assert.deepEqual(await list({ userIds: ["tess"], from: LATER, to: LATER }), [], "not the stored instructor's class any more");
  await plan({ ref: "seam-mon", siteId: "club_churchfield", date: LATER, userId: "tess", by });
  day = await list({ siteIds: ["club_churchfield"], from: LATER, to: LATER });
  assert.deepEqual(day.map((c) => [c.userId, c.planned]), [["tess", true]]);
});

test("a class that has started, is cancelled or does not run that day cannot be planned", async () => {
  const by = { id: "tess", name: "tess" };
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_churchfield", date: NEXT, userId: "tess", by })).ok, false, "started: the register holds it");
  assert.equal((await plan({ ref: "seam-tue", siteId: "club_churchfield", date: "2026-10-06", userId: "cole", by })).ok, false, "cancelled");
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_churchfield", date: "2026-10-20", userId: "cole", by })).ok, false, "a Tuesday");
  assert.equal((await plan({ ref: "seam-mon", siteId: "club_bishopstown", date: MON, userId: "cole", by })).ok, false, "another site");
});

test("many dates at once: days it runs, not started or cancelled; onlyUnplanned keeps what is planned", async () => {
  const by = { id: "tess", name: "tess" };
  // The Monday class: the 17th is a Tuesday, the 23rd is planned with tess first, the 12th
  // of October has started (cole covered it).
  await plan({ ref: "seam-mon", siteId: "club_churchfield", date: "2026-11-23", userId: "tess", by });
  const carried = await planMany({ siteId: "club_churchfield", by, onlyUnplanned: true, items: [
    { ref: "seam-mon", date: "2026-11-16", userId: "cole" }, { ref: "seam-mon", date: "2026-11-17", userId: "cole" },
    { ref: "seam-mon", date: "2026-11-23", userId: "cole" }, { ref: "seam-mon", date: NEXT, userId: "cole" }, { ref: "seam-mon", date: "2026-11-30", userId: "gone" },
  ] });
  assert.deepEqual(carried, { ok: true, planned: 1, skipped: 4 }, "only the 16th: wrong weekday, already planned, started, left");
  const after = await list({ siteIds: ["club_churchfield"], from: "2026-11-16", to: "2026-11-23" });
  assert.deepEqual(after.filter((c) => c.ref === "seam-mon").map((c) => [c.date, c.userId, c.planned, c.usualUserId]), [["2026-11-16", "cole", true, "tess"], ["2026-11-23", "tess", true, "tess"]]);
  const every = await planMany({ siteId: "club_churchfield", by, items: [{ ref: "seam-mon", date: "2026-11-23", userId: "cole" }, { ref: "seam-mon", date: "2026-12-07", userId: "cole" }] });
  assert.deepEqual(every, { ok: true, planned: 2, skipped: 0 }, "without onlyUnplanned a planned day is changed");
  assert.deepEqual((await list({ userIds: ["cole"], from: "2026-11-23", to: "2026-12-07" })).map((c) => c.date), ["2026-11-23", "2026-12-07"]);
});
