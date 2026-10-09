import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { addDaysIso, bookingDates, breakEntitlement, describeEntitlement, followOn, mondayOf, needsFitNote, returnStage, youngBand } from "./constants";
import { today } from "@/lib/format";

/** The rebuilt rota (owner decisions, 6 October 2026), end to end on a throwaway database:
 *  Plan changes the days ahead for its own departments, Run changes any day; warnings never
 *  refuse; a day that has come asks for a reason and keeps a log; staff see shared weeks only.
 *  Invented people and sites. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
let absenceActions: typeof import("./absence-actions");
let data: typeof import("./data");
let absences: typeof import("./absences");
let mine: typeof import("./mine");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "maya", permissions: [] as string[], screens: [] as string[], grants: [] as GrantRow[] };
let churchfield = "", bishopstown = "";
const at = (permission: string, siteId = churchfield): GrantRow => ({ roleName: "Rota", permissions: [permission], screens: ["rota"], scopeKind: "site", scopeId: siteId });

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: state.screens, primaryScreens: state.screens, grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
/** Swim classes the swim school reports through the commitments seam (invented), and what the rota planned. */
type Cls = { source: string; userId: string | null; siteId: string; date: string; startMinutes: number; endMinutes: number; label: string; ref: string; title: string; place: string; planned?: boolean };
const classes: Cls[] = [];
const told: { userId: string | null; line: string }[] = [];
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: (s: { user: { screens: string[] } }, screen: string) => s.user.screens.includes(screen),
    },
    "@/lib/clubs/current": { currentClubId: async () => churchfield, currentClubIdIfAny: async () => churchfield },
    "@/lib/staff-api/notify": { notifyShiftChange: async (userId: string | null, line: string) => { told.push({ userId, line }); } },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
    "@/modules/server": {
      commitmentsFor: async (q: { siteIds?: string[]; userIds?: string[]; from: string; to: string }) => classes.filter((c) => c.date >= q.from && c.date <= q.to
        && (!q.siteIds || q.siteIds.includes(c.siteId)) && (!q.userIds || (!!c.userId && q.userIds.includes(c.userId)))),
      planCommitment: async (_source: string, p: { ref: string; date: string; userId: string | null }) => {
        const c = classes.find((x) => x.ref === p.ref && x.date === p.date);
        if (!c) return { ok: false, error: "That class is no longer on the timetable." };
        Object.assign(c, { userId: p.userId, planned: true });
        return { ok: true };
      },
    },
  };
}
const as = (id: string, grants: GrantRow[] = [], permissions: string[] = []) => Object.assign(state, { id, grants, permissions, screens: permissions.length || grants.length ? ["rota"] : [] });
const tomorrow = () => addDaysIso(today(), 1);
const nextMonday = () => addDaysIso(mondayOf(today()), 7);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ---------- Rules that stayed ---------- */

test("reporting again: still off is an extension; back within four weeks asks 'again?'", () => {
  const toFriday = { id: "b", firstDay: "2026-10-01", lastDay: "2026-10-02" };
  assert.deepEqual(followOn([toFriday], "2026-10-03"), { kind: "extend", absence: toFriday, overlaps: false });
  assert.deepEqual(followOn([toFriday], "2026-10-10"), { kind: "again", absence: toFriday, daysBack: 7 });
  assert.equal(followOn([toFriday], "2026-11-15"), null);
});

test("return to work: due from the first day back; a fit note for sickness over seven days", () => {
  const back = { lastDay: "2026-10-04", returnMetOn: null };
  assert.equal(returnStage(back, "2026-10-07", "2026-10-06"), "waiting");
  assert.equal(returnStage(back, "2026-10-07", "2026-10-07"), "due");
  assert.equal(returnStage(back, null, "2026-10-05"), "due", "nothing on the rota: due the day after");
  assert.equal(needsFitNote({ reason: "sickness", firstDay: "2026-10-01", lastDay: "2026-10-08" }), true);
  assert.equal(needsFitNote({ reason: "family", firstDay: "2026-10-01", lastDay: "2026-10-20" }), false);
});

test("booking dates: the chosen weekdays between the first and last day, skipping the days it does not run", () => {
  assert.deepEqual(bookingDates("2026-10-05", "2026-10-11", [0, 2, 4]), ["2026-10-05", "2026-10-07", "2026-10-09"], "Monday is 0");
  assert.deepEqual(bookingDates("2026-10-05", "2026-10-11", [0, 2, 4], ["2026-10-07"]), ["2026-10-05", "2026-10-09"]);
});

test("breaks by the house rule, under-18s included", () => {
  const total = (m: number, young: "under16" | "under18" | null = null) => breakEntitlement(m, young).map((b) => `${b.minutes}${b.paid ? "p" : "u"}`).join(" ");
  assert.equal(total(240), "", "4 hours: none");
  assert.equal(total(241), "15u");
  assert.equal(total(360), "15p 30u");
  assert.equal(total(480), "15p 30u 15p");
  assert.equal(total(601), "15p 45u 15p");
  assert.equal(total(285, "under18"), "30u", "past 4.5 hours: extended to 30");
  assert.equal(total(255, "under16"), "30u");
  assert.equal(youngBand("2010-10-03", "2026-10-03"), "under18");
  assert.equal(describeEntitlement(540), "60 minutes: 30 unpaid and two 15-minute paid breaks.");
});

/* ---------- The rota on a database ---------- */

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  // Each site's areas (Admin keeps them); an activity's "where" is one of them.
  for (const siteId of [bishopstown, churchfield]) {
    await db.siteArea.createMany({ data: ["Main pool", "Learner pool", "Desk", "Gym"].map((name, i) => ({ orgId: ORG, siteId, name, sortOrder: i })) });
  }
  for (const id of ["maya", "sam", "ava", "riley", "noah", "lee"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, primaryClubId: id === "noah" ? bishopstown : churchfield, siteIds: id === "noah" ? [bishopstown] : [churchfield] } });
  await db.department.create({ data: { id: "d-pool", orgId: ORG, name: "Pool", clubId: churchfield } });
  await db.department.create({ data: { id: "d-desk", orgId: ORG, name: "Reception", clubId: churchfield } });
  await db.userDepartment.create({ data: { userId: "maya", departmentId: "d-pool", isPrimary: true } });
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic lifeguard", validityMonths: 24 } });
  await db.qualification.create({ data: { orgId: ORG, userId: "ava", typeId: "qt-life", issuedOn: new Date("2025-01-01"), expiresOn: new Date("2030-01-01") } });
  await db.qualification.create({ data: { orgId: ORG, userId: "riley", typeId: "qt-life", issuedOn: new Date("2020-01-01"), expiresOn: new Date("2022-01-01") } });
  await db.activityType.create({ data: { id: "t-guard", orgId: ORG, departmentId: "d-pool", name: "Lifeguarding", icon: "lifeguard", requiredTypeId: "qt-life" } });
  await db.activityType.create({ data: { id: "t-teach", orgId: ORG, departmentId: "d-pool", name: "Teaching", icon: "teaching", fromClasses: true } });
  await db.activityType.create({ data: { id: "t-desk", orgId: ORG, departmentId: "d-desk", name: "Reception", icon: "reception" } });
  const d = doubles();
  actions = serverModule("src/modules/rota/lib/actions.ts", d);
  absenceActions = serverModule("src/modules/rota/lib/absence-actions.ts", d);
  data = serverModule("src/modules/rota/lib/data.ts", d);
  absences = serverModule("src/modules/rota/lib/absences.ts", d);
  mine = serverModule("src/modules/rota/lib/mine.ts", d);
});
after(async () => { await fixture?.close(); });

const need = (date: string, extra: Partial<{ typeId: string; place: string; start: string; end: string; places: number; siteId: string }> = {}) =>
  ({ siteId: churchfield, date, typeId: "t-guard", place: "Main pool", start: "07:00", end: "15:00", places: 2, note: "", ...extra });
const needOn = (date: string, place = "Main pool") => fixture.prisma.rotaNeed.findFirstOrThrow({ where: { siteId: churchfield, date: new Date(`${date}T00:00:00Z`), place } });

test("Plan: the days ahead of their own department at their own site; today is the duty manager's", async () => {
  as("maya", [at("rota.plan")]);
  assert.equal((await actions.saveNeed(null, need(tomorrow()))).ok, true);
  assert.equal((await actions.saveNeed(null, need(today()))).ok, false, "today is Run's");
  assert.equal((await actions.saveNeed(null, need(tomorrow(), { typeId: "t-desk", place: "Desk" }))).ok, false, "not their department");
  assert.equal((await actions.saveNeed(null, need(tomorrow(), { siteId: bishopstown }))).ok, false, "not their site");
  as("lee", [at("rota.view")]);
  assert.equal((await actions.saveNeed(null, need(tomorrow(), { place: "Learner pool" }))).ok, false, "View only sees it");
  as("sam", [at("rota.manage")]);
  assert.equal((await actions.saveNeed(null, need(tomorrow(), { typeId: "t-desk", place: "Desk", places: 1 }))).ok, true, "Run: every department");
});

test("putting people on: warnings never refuse; one person at a time on a place; gaps are what is left", async () => {
  as("maya", [at("rota.plan")]);
  const main = await needOn(tomorrow());
  assert.equal((await actions.assign(null, { needId: main.id, place: 1, userId: "riley", start: "07:00", end: "15:00" })).ok, true, "an expired qualification only warns");
  assert.equal((await actions.assign(null, { needId: main.id, place: 1, userId: "ava", start: "10:00", end: "12:00" })).ok, false, "riley is on place 1 then");
  assert.equal((await actions.assign(null, { needId: main.id, place: 2, userId: "ava", start: "07:00", end: "11:00" })).ok, true);
  assert.equal((await actions.assign(null, { needId: main.id, place: 3, userId: "ava", start: "07:00", end: "11:00" })).ok, false, "only two places");
  const plan = await data.planWeek({ site: churchfield, day: tomorrow(), dept: "d-pool" });
  assert.ok(plan.site);
  const group = plan.day!.groups.find((g) => g.place === "Main pool")!;
  assert.deepEqual(group.lanes.map((l) => l.map((b) => [b.kind, b.name, b.warnings])), [
    [["on", "riley", ["expired"]]],
    [["on", "ava", []], ["gap", null, []]],
  ]);
  assert.equal(plan.day!.gapCount, 1);
  assert.equal(plan.week!.find((d) => d.iso === tomorrow())?.gapCount, 1, "the week strip counts it");
  assert.equal(plan.day!.people.find((p) => p.userId === "riley")?.shift.paidMinutes, 8 * 60 - 30, "8 hours less the 30-minute unpaid break");
  assert.equal(await fixture.prisma.rotaLog.count(), 0, "days ahead change freely, nothing logged");
});

test("shifts first: put someone on a shift, give them the day's gaps, and place their breaks", async () => {
  const shift = (extra: Partial<{ userId: string; start: string; end: string }> = {}) => ({ siteId: churchfield, departmentId: "d-pool", date: tomorrow(), userId: "ava", start: "07:00", end: "15:00", ...extra });
  as("lee", [at("rota.view")]);
  assert.equal((await actions.savePlanShift(null, shift())).ok, false, "View only sees it");
  as("maya", [at("rota.plan")]);
  assert.equal((await actions.savePlanShift(null, shift())).ok, true);
  assert.equal((await actions.savePlanShift(null, shift({ start: "14:00", end: "18:00" }))).ok, false, "two of their shifts here may not overlap");
  const plan = await data.planWeek({ site: churchfield, day: tomorrow(), dept: "d-pool" });
  const ava = plan.day!.people.find((p) => p.userId === "ava")!;
  assert.deepEqual(ava.shift.parts.map((x) => x.planned), [true]);
  const take = ava.options.find((o) => o.ok)!;
  assert.equal(take.place, 2, "the gap on place 2 after her time on it");
  assert.ok(take.start >= 11 * 60 && take.end <= 15 * 60);

  // The manager places her breaks; one during her activity leaves that time to cover.
  const breaks = (list: [string, number, boolean][]) => ({ siteId: churchfield, departmentId: "d-pool", date: tomorrow(), userId: "ava", breaks: list.map(([start, minutes, paid]) => ({ start, minutes, paid })) });
  assert.equal((await actions.saveBreaks(breaks([["12:00", 30, false], ["12:15", 15, true]]))).ok, false, "breaks may not overlap");
  assert.equal((await actions.saveBreaks(breaks([["09:00", 15, true], ["12:00", 30, false], ["13:30", 15, true]]))).ok, true);
  assert.equal((await actions.saveBreaks({ ...breaks([]), userId: "noah" })).ok, false, "not on this department's plan");
  const after = (await data.planWeek({ site: churchfield, day: tomorrow(), dept: "d-pool" })).day!.people.find((p) => p.userId === "ava")!;
  assert.deepEqual(after.shift.parts[0].breaks.map((b) => [b.start, b.pinned]), [[9 * 60, true], [12 * 60, true], [13 * 60 + 30, true]]);
  assert.deepEqual(after.breakClashes.map((c) => c.start), [9 * 60]);
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entity: "RotaBreak" } }));

  const row = await fixture.prisma.rotaPlanShift.findFirstOrThrow({ where: { userId: "ava" } });
  assert.equal((await actions.removePlanShift(row.id)).ok, true);
  assert.equal(await fixture.prisma.rotaBreak.count({ where: { userId: "ava" } }), 0, "its breaks go with it");
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "RotaPlanShift" } }), 2);
});

test("who can fill it: qualified and free first; nobody is left out", async () => {
  as("maya", [at("rota.plan")]);
  const fits = await data.fitsFor({ siteId: churchfield, date: tomorrow(), start: 11 * 60, end: 15 * 60, requiredTypeId: "qt-life" });
  assert.equal(fits[0].userId, "ava", "qualified, and free from 11:00");
  assert.ok(fits.find((f) => f.userId === "riley")!.issues.includes("overlap"));
  assert.ok(fits.find((f) => f.userId === "sam")!.issues.includes("missing"));
  assert.ok(!fits.some((f) => f.userId === "noah"), "works at another site");
});

test("a day that has come: every change asks why, goes in the log, and waits for Timepoint", async () => {
  as("sam", [at("rota.manage")]);
  assert.equal((await actions.saveNeed(null, need(today(), { place: "Learner pool", places: 1 }))).ok, false, "say why");
  assert.equal((await actions.saveNeed(null, need(today(), { place: "Learner pool", places: 1 }), { reason: "correction" })).ok, true);
  const learner = await needOn(today(), "Learner pool");
  assert.equal((await actions.assign(null, { needId: learner.id, place: 1, userId: "ava", start: "07:00", end: "15:00" }, { reason: "fill", note: "Agreed at 7" })).ok, true);
  const logged = await fixture.prisma.rotaLog.findFirstOrThrow({ where: { userId: "ava" } });
  assert.deepEqual([logged.reason, logged.note, logged.timepointAt], ["fill", "Agreed at 7", null]);
  assert.match(logged.summary, /ava put on Lifeguarding, Learner pool, 07:00 to 15:00/);
  assert.equal((await actions.markTimepointUpdated(logged.id)).ok, true);
  assert.ok((await fixture.prisma.rotaLog.findUniqueOrThrow({ where: { id: logged.id } })).timepointAt);
  as("maya", [at("rota.plan")]);
  assert.equal((await actions.markTimepointUpdated(logged.id)).ok, true, "already done: nothing to do");
});

test("someone off: their activities need cover, and covering swaps them on that place with the absence linked", async () => {
  as("sam", [at("rota.manage")]);
  assert.equal((await absenceActions.reportAbsence({ userId: "ava", reason: "sickness", firstDay: today(), lastDay: today(), note: "" })).ok, true);
  const day = await data.todayAt(churchfield);
  assert.ok(day.site);
  const learner = day.day!.groups.find((g) => g.place === "Learner pool")!;
  assert.deepEqual(learner.lanes[0].map((b) => [b.kind, b.name, b.warnings]), [["on", "ava", ["off"]]]);
  assert.equal(learner.gapCount, 1, "it needs cover");
  const ava = await fixture.prisma.rotaAssignment.findFirstOrThrow({ where: { userId: "ava", need: { date: new Date(`${today()}T00:00:00Z`) } } });
  assert.equal((await actions.assign(ava.id, { needId: ava.needId, place: 1, userId: "riley", start: "07:00", end: "15:00" }, { reason: "cover" })).ok, true);
  const cover = await fixture.prisma.rotaLog.findFirstOrThrow({ where: { userId: "riley", reason: "cover" } });
  const absence = await fixture.prisma.rotaAbsence.findFirstOrThrow({ where: { userId: "ava", withdrawnAt: null } });
  assert.equal(cover.absenceId, absence.id, "the absence it covers");
  const page = await absences.rotaAbsences();
  assert.equal(page.current.find((a) => a.userId === "ava")?.shiftsToCover, 0, "nothing of theirs left to cover today");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "RotaAbsence" } });
  assert.doesNotMatch(audit.summary, /sick/i, "the shared log never says why");
  as("noah", [at("rota.manage", bishopstown)]);
  assert.equal((await absenceActions.withdrawAbsence(absence.id)).ok, false, "a duty manager at another site");
  as("maya", [at("rota.plan")]);
  await assert.rejects(absences.rotaAbsences(), /Running the rota/);
});

test("copy fills only days with nothing of that department; people come too unless left out", async () => {
  as("maya", [at("rota.plan")]);
  const from = tomorrow(), to = addDaysIso(tomorrow(), 14);
  assert.equal((await actions.copyPlan({ siteId: churchfield, departmentId: "d-pool", from, to, days: 1, people: true })).ok, true);
  const copied = await fixture.prisma.rotaNeed.findFirstOrThrow({ where: { date: new Date(`${to}T00:00:00Z`), place: "Main pool" }, include: { assignments: true } });
  assert.deepEqual(copied.assignments.map((a) => a.userId).sort(), ["ava", "riley"]);
  assert.equal((await actions.copyPlan({ siteId: churchfield, departmentId: "d-pool", from, to, days: 1, people: true })).ok, false, "never doubled");
  assert.equal((await actions.copyPlan({ siteId: churchfield, departmentId: "d-pool", from, to: addDaysIso(to, 1), days: 1, people: false })).ok, true);
  assert.equal(await fixture.prisma.rotaAssignment.count({ where: { need: { date: new Date(`${addDaysIso(to, 1)}T00:00:00Z`) } } }), 0, "the activities only");
  assert.equal(await fixture.prisma.rotaNeed.count({ where: { date: new Date(`${to}T00:00:00Z`), type: { departmentId: "d-desk" } } }), 0, "another department is not copied");
});

test("sharing a week: staff see it in Turnfin Me and are told; until then they see nothing", async () => {
  as("maya", [at("rota.plan")]);
  const monday = nextMonday();
  assert.equal((await actions.saveNeed(null, need(monday, { place: "Main pool", places: 1, start: "09:00", end: "14:30" }))).ok, true);
  const main = await needOn(monday);
  assert.equal((await actions.assign(null, { needId: main.id, place: 1, userId: "ava", start: "09:00", end: "11:30" })).ok, true);
  assert.equal((await actions.assign(null, { needId: main.id, place: 1, userId: "ava", start: "11:45", end: "14:30" })).ok, true);
  assert.equal((await mine.myDays("ava", 28)).filter((d) => d.date === monday).length, 0, "a draft");
  told.length = 0;
  assert.equal((await actions.shareWeek({ siteId: churchfield, departmentId: "d-desk", monday })).ok, false, "not a department they plan");
  assert.equal((await actions.shareWeek({ siteId: churchfield, departmentId: "d-pool", monday })).ok, true);
  assert.ok(told.some((t) => t.userId === "ava" && /ready/.test(t.line)), "told once");
  const day = (await mine.myDays("ava", 28)).find((d) => d.date === monday)!;
  assert.deepEqual(day.items.map((i) => [i.label, i.place, i.start, i.end]), [["Lifeguarding", "Main pool", 540, 690], ["Lifeguarding", "Main pool", 705, 870]]);
  assert.deepEqual(day.shift.parts[0].breaks, [{ start: 690, end: 705, paid: false, pinned: false }], "the break goes in the free quarter hour");
  told.length = 0;
  assert.equal((await actions.unassign((await fixture.prisma.rotaAssignment.findFirstOrThrow({ where: { userId: "ava", needId: main.id, startMinutes: 705 } })).id)).ok, true);
  assert.ok(told.some((t) => t.userId === "ava" && /no longer/.test(t.line)), "a change after sharing is told");
});

test("bookings repeat an activity on their days ahead; cancelling removes the days still to come", async () => {
  as("maya", [at("rota.plan")]);
  const first = nextMonday();
  const input = { siteId: churchfield, kind: "school" as const, title: "Example National School", typeId: "t-guard", place: "Learner pool", start: "09:30", end: "11:30", places: 1,
    weekdays: [0, 2], firstDay: first, lastDay: addDaysIso(first, 13), skipDates: [addDaysIso(first, 2)] };
  assert.equal((await actions.saveRepeat({ ...input, typeId: "t-desk" })).ok, false, "not their department");
  assert.equal((await actions.saveRepeat(input)).ok, true);
  const repeat = await fixture.prisma.rotaRepeat.findFirstOrThrow({ where: { title: "Example National School" } });
  const days = await fixture.prisma.rotaNeed.findMany({ where: { repeatId: repeat.id }, orderBy: { date: "asc" } });
  assert.deepEqual(days.map((n) => iso(n.date)), [first, addDaysIso(first, 7), addDaysIso(first, 9)], "Mondays and Wednesdays, the skipped Wednesday left out");
  assert.equal((await actions.cancelRepeat(repeat.id)).ok, true);
  assert.equal(await fixture.prisma.rotaNeed.count({ where: { repeatId: repeat.id } }), 0);
});

test("swim classes are Teaching; the rota plans their teacher through the swim school", async () => {
  as("maya", [at("rota.plan")]);
  const day = addDaysIso(nextMonday(), 1);
  classes.push(
    { source: "activities.classes", userId: "lee", siteId: churchfield, date: day, startMinutes: 960, endMinutes: 990, label: "Stage 1, Learner pool", ref: "c1", title: "Stage 1", place: "Learner pool" },
    { source: "activities.classes", userId: null, siteId: churchfield, date: day, startMinutes: 990, endMinutes: 1020, label: "Stage 2, Learner pool", ref: "c2", title: "Stage 2", place: "Learner pool" },
  );
  let plan = await data.planWeek({ site: churchfield, day, dept: "d-pool" });
  const teaching = plan.day!.groups.find((g) => g.fromClasses)!;
  assert.deepEqual([teaching.name, teaching.place, teaching.gapCount], ["Teaching", "Learner pool", 1]);
  assert.equal((await actions.planTeacher({ siteId: churchfield, date: day, classRef: "c2", userId: "lee" })).ok, true);
  plan = await data.planWeek({ site: churchfield, day, dept: "d-pool" });
  assert.equal(plan.day!.groups.find((g) => g.fromClasses)!.gapCount, 0);
  as("sam", [at("rota.manage", bishopstown)]);
  assert.equal((await actions.planTeacher({ siteId: churchfield, date: day, classRef: "c2", userId: null })).ok, false, "another site's duty manager");
  classes.length = 0;
});

test("an archived activity on Admin's list is no longer planned", async () => {
  const gym = await fixture.prisma.activityType.create({ data: { orgId: ORG, name: "Gym floor", departmentId: "d-desk", icon: "gym", archivedAt: new Date() } });
  as("sam", [at("rota.manage")]);
  assert.equal((await actions.saveNeed(null, need(tomorrow(), { typeId: gym.id }))).ok, false, "archived: no longer planned");
});

test("the personal file keeps the changes to their activities on days that had come", async () => {
  const file = serverModule<typeof import("./file")>("src/modules/rota/lib/file.ts", doubles());
  const riley = await file.dutyChangeFile("riley", ORG);
  assert.ok(riley.entries.some((e) => /riley put on Lifeguarding/.test(e.title) && /Covering an absence · by sam/.test(e.detail)));
});
