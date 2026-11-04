import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { mondayOf } from "@/modules/staffing/shared/rules";

/** Staffing end to end on an isolated database: the migration's exam seasons, slots and teachers,
 *  building and publishing a block, acknowledgements, a swap and its no-show, call-offs, exam
 *  absences and the strike ladder, each at the person's own sites, and the audit trail. Invented
 *  people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let setup: typeof import("../features/setup/server/actions");
let blocks: typeof import("../features/blocks/server/actions");
let blockData: typeof import("../features/blocks/server/data");
let todayActions: typeof import("../features/today/server/actions");
let requests: typeof import("../features/requests/server/actions");
let strikes: typeof import("../features/strikes/server/actions");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "sup", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
class Denied extends Error {}
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["staffing"], primaryScreens: ["staffing"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["staffing"], scopeKind: "site", scopeId: siteId });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const [id, minutes] of [["sup", null], ["dm", null], ["ann", 600], ["bea", 360], ["cal", null]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [bishopstown], contractMinutes: minutes } });
  }
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  setup = serverModule("src/modules/staffing/features/setup/server/actions.ts", d);
  blocks = serverModule("src/modules/staffing/features/blocks/server/actions.ts", d);
  blockData = serverModule("src/modules/staffing/features/blocks/server/data.ts", d);
  todayActions = serverModule("src/modules/staffing/features/today/server/actions.ts", d);
  requests = serverModule("src/modules/staffing/features/requests/server/actions.ts", d);
  strikes = serverModule("src/modules/staffing/features/strikes/server/actions.ts", d);
});
after(async () => { await fixture?.close(); });

const start = addDaysIso(mondayOf(today()), 35);
let blockId = "";

test("the migration gives each organisation the 2026-27 exam seasons", async () => {
  const seasons = await fixture.prisma.staffingExamSeason.findMany({ where: { orgId: ORG }, orderBy: { startsOn: "asc" } });
  assert.deepEqual(seasons.map((s) => `${s.college} ${s.name}`), ["ucc winter", "mtu winter", "ucc summer", "mtu summer"]);
});

test("slots and teachers are kept by Supervise at the site; strikes count from a date the manager sets", async () => {
  as("sup", [], [at(churchfield, ["staffing.supervise"])]);
  assert.equal((await setup.saveSlot(bishopstown, null, { name: "School morning", weekdays: [2], role: "teaching", start: "10:15", end: "13:15", needed: 2 })).ok, false, "not their site");
  as("sup", ["staffing.manage"], [at(bishopstown, ["staffing.manage"])]);
  assert.equal((await setup.saveSlot(bishopstown, null, { name: "School morning", weekdays: [2, 3], role: "teaching", start: "10:15", end: "13:15", needed: 2 })).ok, true);
  assert.equal((await setup.saveSlot(bishopstown, null, { name: "Lifeguard", weekdays: [2], role: "lifeguard", start: "14:00", end: "16:00", needed: 1 })).ok, true);
  assert.equal((await setup.saveSlot(bishopstown, null, { name: "Backwards", weekdays: [2], role: "teaching", start: "14:00", end: "13:00", needed: 1 })).ok, false);
  for (const [id, college] of [["ann", "ucc"], ["bea", "mtu"], ["cal", "ucc"]] as const) {
    assert.equal((await setup.saveTeacher(bishopstown, id, true, { college, contract: "swim_teacher", wantsMore: id === "cal" })).ok, true);
  }
  assert.equal((await setup.saveSettings({ strikeCountingFrom: "2026-01-01", restHours: 10 })).ok, false, "rest can't go below the law");
  assert.equal((await setup.saveSettings({ strikeCountingFrom: "2026-01-01" })).ok, true);
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "StaffingSlot" } })).module, "Staffing");
});

test("a block takes its places from the slots; a swim-teacher contract on a lifeguard place is warned, not refused", async () => {
  as("sup", ["staffing.manage"], [at(bishopstown, ["staffing.manage"])]);
  assert.equal((await blocks.createBlock(bishopstown, addDaysIso(start, 1))).ok, false, "a block starts on a Monday");
  const made = await blocks.createBlock(bishopstown, start);
  assert.equal(made.ok, true);
  blockId = made.ok ? made.id : "";
  const shifts = await fixture.prisma.staffingShift.findMany({ where: { blockId }, orderBy: [{ date: "asc" }, { startMin: "asc" }] });
  assert.equal(shifts.length, 10, "two Tuesdays and Wednesdays of two teachers, two Tuesday lifeguards");
  const lifeguard = shifts.find((s) => s.role === "lifeguard")!;
  assert.equal((await blocks.assignShift(lifeguard.id, { userId: "cal" })).ok, true, "warnings never refuse");
  const page = await blockData.blockPage(blockId);
  assert.ok(page.hours.find((h) => h.userId === "ann")!.short > 0);
});

test("publishing needs below-contract teachers accepted with a note, then tracks acknowledgements", async () => {
  as("sup", [], [at(bishopstown, ["staffing.supervise"])]);
  const teaching = await fixture.prisma.staffingShift.findMany({ where: { blockId, role: "teaching" }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  for (const [i, s] of teaching.entries()) await blocks.assignShift(s.id, { userId: i % 2 ? "bea" : "ann" });
  const refused = await blocks.publishBlock(blockId, "");
  assert.equal(refused.ok, false, "ann is below 10 hours a week");
  assert.equal((await blocks.publishBlock(blockId, "Agreed with Ann: no more school slots")).ok, true);
  const acks = await fixture.prisma.staffingAck.findMany({ where: { blockId } });
  assert.deepEqual(acks.map((a) => a.userId).sort(), ["ann", "bea", "cal"]);
  assert.equal((await blocks.recordAck(blockId, "ann", "acknowledged")).ok, true);
  assert.equal((await blocks.assignShift(teaching[0].id, { userId: "cal" })).ok, false, "a published block changes only with Manage");
});

test("a swap: under 48 hours it is closed; approved, the taker owns the shift and its no-show strike", async () => {
  as("sup", [], [at(bishopstown, ["staffing.supervise"])]);
  const annShift = await fixture.prisma.staffingShift.findFirstOrThrow({ where: { blockId, userId: "ann" }, orderBy: { date: "asc" } });
  assert.equal((await requests.requestSwap(annShift.id, { takerId: null, takerAgreed: false })).ok, true);
  assert.equal((await requests.requestSwap(annShift.id, { takerId: null, takerAgreed: false })).ok, false, "one open swap per shift");
  const swap = await fixture.prisma.staffingSwap.findFirstOrThrow({ where: { shiftId: annShift.id } });
  assert.equal((await requests.decideSwap(swap.id, { approve: true })).ok, false, "nobody has taken it");
  assert.equal((await requests.acceptSwap(swap.id, "cal")).ok, true);
  assert.equal((await fixture.prisma.staffingShift.findUniqueOrThrow({ where: { id: annShift.id } })).userId, "ann", "still Ann's until approved");
  assert.equal((await requests.decideSwap(swap.id, { approve: true })).ok, true);
  assert.equal((await fixture.prisma.staffingShift.findUniqueOrThrow({ where: { id: annShift.id } })).userId, "cal");

  // The day comes: Cal doesn't call or show.
  as("dm", [], [at(bishopstown, ["staffing.run"])]);
  assert.equal((await todayActions.logAttendance(annShift.id, { kind: "no_show" })).ok, true);
  const strike = await fixture.prisma.staffingStrike.findFirstOrThrow({ where: { sourceId: { not: null } }, orderBy: { createdAt: "desc" } });
  assert.equal(strike.userId, "cal", "the taker owns the strike");
  assert.equal(strike.cause, "swap_no_show");
  assert.equal(strike.stage, "serious_misconduct_referral");

  // A shift tomorrow can't be swapped.
  const soon = await fixture.prisma.staffingShift.create({ data: { orgId: ORG, siteId: bishopstown, blockId, date: new Date(`${addDaysIso(today(), 1)}T00:00:00Z`), startMin: 600, endMin: 700, role: "teaching", name: "Tomorrow", userId: "bea" } });
  as("sup", [], [at(bishopstown, ["staffing.supervise"])]);
  const closed = await requests.requestSwap(soon.id, { takerId: "ann", takerAgreed: true });
  assert.equal(closed.ok, false);
  assert.match(closed.ok ? "" : closed.error, /phone the duty manager/);
});

test("call-offs: a text is never on time and is a strike; strikes climb the ladder", async () => {
  as("dm", [], [at(bishopstown, ["staffing.run"])]);
  const day = today();
  const make = (name: string) => fixture.prisma.staffingShift.create({ data: { orgId: ORG, siteId: bishopstown, blockId, date: new Date(`${addDaysIso(day, 2)}T00:00:00Z`), startMin: 960, endMin: 1080, role: "teaching", name, userId: "bea" } });
  const first = await make("First");
  assert.equal((await todayActions.logAttendance(first.id, { kind: "call_off", calledOn: day, calledAt: "08:00", method: "phone", reason: "sick" })).ok, true);
  assert.equal(await fixture.prisma.staffingStrike.count({ where: { userId: "bea" } }), 0, "a properly reported sick day is not a strike");
  const second = await make("Second");
  assert.equal((await todayActions.logAttendance(second.id, { kind: "call_off", calledOn: day, calledAt: "08:00", method: "text", reason: "sick" })).ok, true);
  const third = await make("Third");
  assert.equal((await todayActions.logAttendance(third.id, { kind: "late", minutesLate: 75, sentHome: true })).ok, true);
  const bea = await fixture.prisma.staffingStrike.findMany({ where: { userId: "bea" }, orderBy: { number: "asc" } });
  assert.deepEqual(bea.map((s) => [s.number, s.cause, s.stage]), [[1, "late_call_off", "informal_1"], [2, "late_arrival", "informal_2"]]);
  assert.equal((await fixture.prisma.staffingShift.findUniqueOrThrow({ where: { id: third.id } })).status, "sent_home");

  // Strike 2 needs Supervise and a signed note; strike 1's chat needs Run.
  assert.equal((await strikes.handleStrike(bea[1].id, { note: "Talked it through" })).ok, false, "Run can't hold strike 2");
  assert.equal((await strikes.handleStrike(bea[0].id, { note: "Return-to-work chat held" })).ok, true);
  as("sup", [], [at(bishopstown, ["staffing.supervise"])]);
  assert.equal((await strikes.handleStrike(bea[1].id, { note: "Second informal" })).ok, false, "signed by both");
  assert.equal((await strikes.handleStrike(bea[1].id, { note: "Second informal", signedByBoth: true })).ok, true);
  assert.equal((await strikes.withdrawStrike(bea[1].id, "Logged in error")).ok, false, "only Manage withdraws");
});

test("an exam absence after the season's deadline is approved, unpaid, with a strike; without a notice it is refused", async () => {
  as("sup", [], [at(bishopstown, ["staffing.supervise"])]);
  const exam = await fixture.prisma.staffingShift.create({ data: { orgId: ORG, siteId: bishopstown, blockId, date: new Date("2026-12-08T00:00:00Z"), startMin: 615, endMin: 795, role: "teaching", name: "Exam day", userId: "ann" } });
  // Asked today with the notice: on time until the UCC winter deadline (16 November), late after it.
  const asked = await requests.recordExamAbsence(exam.id, { requestedOn: "2026-11-04", requestedTime: "09:00", noticeSentOn: "2026-10-20" });
  assert.equal(asked.ok, true);
  const row = await fixture.prisma.staffingExamAbsence.findFirstOrThrow({ where: { shiftId: exam.id } });
  assert.equal(row.status, "approved");
  assert.equal(row.outcome, today() <= "2026-11-16" ? "on_time" : "late_notice");
  assert.equal((await fixture.prisma.staffingShift.findUniqueOrThrow({ where: { id: exam.id } })).status, "absent_approved");
  const none = await fixture.prisma.staffingShift.create({ data: { orgId: ORG, siteId: bishopstown, blockId, date: new Date("2026-12-09T00:00:00Z"), startMin: 615, endMin: 795, role: "teaching", name: "No notice", userId: "ann" } });
  assert.equal((await requests.recordExamAbsence(none.id, { requestedOn: "2026-11-04", requestedTime: "09:00", noticeSentOn: null })).ok, true);
  const refused = await fixture.prisma.staffingExamAbsence.findFirstOrThrow({ where: { shiftId: none.id } });
  assert.equal(refused.status, "refused");
  assert.equal((await fixture.prisma.staffingStrike.findUniqueOrThrow({ where: { id: refused.strikeId! } })).stage, "serious_misconduct_referral");
});
