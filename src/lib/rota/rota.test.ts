import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { PAID_BREAK, UNPAID_BREAK, absentOn, addDaysIso, bookingDates, breakEntitlement, describeEntitlement, followOn, isPaidBreak, mondayOf, needsFitNote, parseClock, returnStage, segmentProblem, shiftWarnings, suggestBreaks, youngBand } from "./constants";
import { today } from "@/lib/format";
import { buildPlan } from "./plan";

/** The Rota: a site-scoped planner plans only their site, qualification gaps
 *  and double-bookings warn but never refuse, and each person sees only their
 *  own shifts. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
let data: typeof import("./data");
let mine: typeof import("./mine");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "maya", permissions: [] as string[], screens: [] as string[], grants: [] as GrantRow[] };
let churchfield = "", bishopstown = "";
const planner = (): GrantRow => ({ roleName: "Duty", permissions: ["rota.manage"], screens: ["rota"], scopeKind: "site", scopeId: churchfield });

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: state.screens, primaryScreens: state.screens, grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
/** Swim classes the Swim school reports through the commitments seam (invented). */
const classes: { source: string; userId: string | null; siteId: string; date: string; startMinutes: number; endMinutes: number; label: string; href?: string }[] = [];
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
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
    "@/modules/server": {
      commitmentsFor: async (q: { siteIds?: string[]; userIds?: string[]; from: string; to: string }) => classes.filter((c) => c.date >= q.from && c.date <= q.to
        && (!q.siteIds || q.siteIds.includes(c.siteId)) && (!q.userIds || (!!c.userId && q.userIds.includes(c.userId)))),
    },
  };
}
const as = (id: string, grants: GrantRow[] = [], permissions: string[] = []) => Object.assign(state, { id, grants, permissions, screens: permissions.length ? ["rota"] : [] });

test("warnings: open, missing, expired on the day, and overlaps", () => {
  const day = new Date("2026-10-05T00:00:00Z");
  const shift = { id: "a", userId: "u", date: day, startMinutes: 420, endMinutes: 900, requiredTypeId: "t" };
  assert.deepEqual(shiftWarnings({ ...shift, userId: null }, [], []), ["open"]);
  assert.deepEqual(shiftWarnings(shift, [], []), ["missing"]);
  const expired = { typeId: "t", issuedOn: new Date("2024-01-01"), expiresOn: new Date("2026-10-04"), revokedAt: null };
  assert.deepEqual(shiftWarnings(shift, [expired], []), ["expired"]);
  assert.deepEqual(shiftWarnings(shift, [{ ...expired, expiresOn: new Date("2026-10-05") }], []), [], "valid through the shift's day");
  assert.deepEqual(shiftWarnings(shift, [{ ...expired, expiresOn: null, revokedAt: new Date() }], []), ["missing"], "withdrawn does not count");
  const overlap = { ...shift, id: "b", startMinutes: 840, endMinutes: 1000, requiredTypeId: null };
  assert.deepEqual(shiftWarnings({ ...shift, requiredTypeId: null }, [], [overlap]), ["overlap"]);
  assert.deepEqual(shiftWarnings({ ...shift, requiredTypeId: null }, [], [{ ...overlap, startMinutes: 900 }]), [], "back-to-back is fine");
  assert.equal(parseClock("07:30"), 450);
  assert.equal(parseClock("25:00"), null);
  assert.equal(mondayOf("2026-10-04"), "2026-09-28", "Sunday belongs to the week before");
});

test("absence: the person's shifts on their days off warn Absent; an open-ended one runs on", () => {
  const day = new Date("2026-10-05T00:00:00Z");
  const shift = { id: "a", userId: "u", date: day, startMinutes: 420, endMinutes: 900, requiredTypeId: null };
  const off = { userId: "u", firstDay: new Date("2026-10-05T00:00:00Z"), lastDay: new Date("2026-10-06T00:00:00Z") };
  assert.deepEqual(shiftWarnings(shift, [], [], [off]), ["absent"]);
  assert.deepEqual(shiftWarnings(shift, [], [], [{ ...off, userId: "someone-else" }]), []);
  assert.deepEqual(shiftWarnings({ ...shift, userId: null }, [], [], [off]), ["open"], "an open shift has nobody to be off");
  assert.equal(absentOn([off], "u", "2026-10-06"), true, "the last day counts");
  assert.equal(absentOn([off], "u", "2026-10-07"), false);
  assert.equal(absentOn([{ ...off, lastDay: null }], "u", "2027-01-01"), true, "no last day yet");
  assert.equal(absentOn([off], "u", "2026-10-04"), false);
});

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava", "riley", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG } });
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic lifeguard", validityMonths: 24 } });
  await db.qualification.create({ data: { orgId: ORG, userId: "ava", typeId: "qt-life", issuedOn: new Date("2025-01-01"), expiresOn: new Date("2030-01-01") } });
  await db.qualification.create({ data: { orgId: ORG, userId: "riley", typeId: "qt-life", issuedOn: new Date("2020-01-01"), expiresOn: new Date("2022-01-01") } });
  const d = doubles();
  actions = serverModule("src/lib/rota/actions.ts", d);
  data = serverModule("src/lib/rota/data.ts", d);
  mine = serverModule("src/lib/rota/mine.ts", d);
});
after(async () => { await fixture?.close(); });

const tomorrow = () => addDaysIso(today(), 1);
test("a site-scoped planner plans only their site; warnings never block", async () => {
  as("maya", [planner()]);
  const shift = (siteId: string, userId: string, start = "07:00", end = "15:00") => ({ siteId, date: tomorrow(), start, end, role: "Lifeguard", requiredTypeId: "qt-life", userId, note: "", reason: "extra" as const });
  assert.equal((await actions.saveShift(null, shift(bishopstown, "ava"))).ok, false, "another site");
  assert.equal((await actions.saveShift(null, shift(churchfield, "ava"))).ok, true);
  assert.equal((await actions.saveShift(null, shift(churchfield, "riley"))).ok, true, "an expired qualification still saves");
  assert.equal((await actions.saveShift(null, shift(churchfield, "noah", "14:00", "18:00"))).ok, true, "no qualification still saves");
  assert.equal((await actions.saveShift(null, shift(churchfield, "ava", "14:00", "18:00"))).ok, true, "a double-booking still saves");
  assert.equal((await actions.saveShift(null, { ...shift(churchfield, ""), start: "15:00", end: "07:00" })).ok, false, "ends before it starts");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "RotaShift" } });
  assert.equal(audit.clubId, churchfield, "audited at the shift's site");
});

test("the week shows each shift's warnings, and only the sites the role covers", async () => {
  as("maya", [planner()]);
  const week = await data.rotaWeek(undefined, tomorrow());
  assert.deepEqual(week.sites.map((s) => s.id), [churchfield]);
  const shifts = week.days.flatMap((d) => d.shifts);
  const by = (user: string) => shifts.filter((s) => s.userId === user).map((s) => s.warnings);
  assert.deepEqual(by("riley"), [["expired"]]);
  assert.deepEqual(by("noah"), [["missing"]]);
  assert.deepEqual(by("ava"), [["overlap"], ["overlap"]]);
  await assert.rejects(data.rotaWeek(bishopstown, undefined), NotFound);
  as("noah");
  await assert.rejects(data.rotaWeek(undefined, undefined), /Rota access/);
});

test("each person sees only their own shifts, with qualification warnings", async () => {
  const riley = await mine.myShifts("riley", 7);
  assert.equal(riley.length, 1);
  assert.deepEqual(riley[0].warnings, ["expired"]);
  const ava = await mine.myShifts("ava", 7);
  assert.equal(ava.length, 2);
  assert.ok(ava.every((s) => s.warnings.length === 0), "double-bookings are the planner's to fix");
  assert.ok([...riley, ...ava].every((s) => s.userId === "riley" || s.userId === "ava"));
});

test("cancelling needs the permission at that site", async () => {
  const shift = await fixture.prisma.rotaShift.findFirstOrThrow({ where: { userId: "noah" } });
  as("noah", [{ ...planner(), scopeId: bishopstown }]);
  assert.equal((await actions.cancelShift(shift.id, { reason: "correction" })).ok, false);
  as("maya", [planner()]);
  assert.equal((await actions.cancelShift(shift.id, { reason: "correction" })).ok, true);
  assert.equal((await actions.cancelShift(shift.id, { reason: "correction" })).ok, false);
});

test("reporting again: still off (or off until yesterday) is an extension; back within four weeks asks 'again?'", () => {
  const open = { id: "a", firstDay: "2026-10-01", lastDay: null };
  assert.deepEqual(followOn([open], "2026-10-05"), { kind: "extend", absence: open, overlaps: true });
  const toFriday = { id: "b", firstDay: "2026-10-01", lastDay: "2026-10-02" };
  assert.deepEqual(followOn([toFriday], "2026-10-03"), { kind: "extend", absence: toFriday, overlaps: false }, "the day after their last day off runs on");
  assert.deepEqual(followOn([toFriday], "2026-10-02"), { kind: "extend", absence: toFriday, overlaps: true });
  assert.deepEqual(followOn([toFriday], "2026-10-10"), { kind: "again", absence: toFriday, daysBack: 7 });
  assert.equal(followOn([toFriday], "2026-11-15"), null, "long after: nothing to ask");
  assert.equal(followOn([toFriday], "2026-09-20"), null, "before it: nothing to ask");
  const older = { id: "c", firstDay: "2026-09-01", lastDay: "2026-09-03" };
  assert.equal(followOn([older, toFriday], "2026-10-06")?.absence.id, "b", "the latest one counts");
});

test("absences: a site planner records them only for people at their site, never logging the reason", async () => {
  await fixture.prisma.user.update({ where: { id: "ava" }, data: { primaryClubId: churchfield } });
  await fixture.prisma.user.update({ where: { id: "noah" }, data: { primaryClubId: bishopstown } });
  as("maya", [planner()]);
  const input = (userId: string, extra: Record<string, string> = {}) => ({ userId, reason: "sickness" as const, firstDay: tomorrow(), lastDay: "", note: "", ...extra });
  assert.equal((await actions.reportAbsence(input("noah"))).ok, false, "someone at another site");
  assert.equal((await actions.reportAbsence(input("ava", { lastDay: today() }))).ok, false, "ends before it starts");
  assert.equal((await actions.reportAbsence(input("ava"))).ok, true);
  assert.equal((await actions.reportAbsence(input("ava", { firstDay: addDaysIso(tomorrow(), 3) }))).ok, false, "already off, with no last day");

  const shifts = (await data.rotaWeek(churchfield, tomorrow())).days.flatMap((d) => d.shifts).filter((s) => s.userId === "ava");
  assert.ok(shifts.length > 0 && shifts.every((s) => s.warnings.includes("absent")), "their shifts need cover");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "RotaAbsence" } });
  assert.equal(audit.clubId, null);
  assert.equal(audit.module, "Rota");
  assert.doesNotMatch(audit.summary, /sick/i, "the shared log never says why");

  const page = await data.rotaAbsences();
  assert.deepEqual(page.current.map((a) => [a.userId, a.shiftsToCover]), [["ava", shifts.length]]);
  assert.ok(!page.people.some((p) => p.id === "noah"), "only people the role covers can be chosen");
  const id = page.current[0].id;

  assert.equal((await actions.endAbsence(id, today())).ok, false, "back before it started");
  assert.equal((await actions.endAbsence(id, tomorrow())).ok, true);
  const later = (await data.rotaWeek(churchfield, tomorrow())).days.flatMap((d) => d.shifts).filter((s) => s.userId === "ava");
  assert.ok(later.every((s) => s.warnings.includes("absent")), "the last day off still counts");

  // Still off: the same absence runs on, once, and keeps its story.
  assert.equal((await actions.extendAbsence(id, { lastDay: tomorrow(), note: "" })).ok, false, "not later than now");
  assert.equal((await actions.extendAbsence(id, { lastDay: addDaysIso(tomorrow(), 4), note: "Called again" })).ok, true);
  assert.equal((await actions.extendAbsence(id, { lastDay: "", note: "" })).ok, true, "return not known");
  assert.equal((await actions.extendAbsence(id, { lastDay: "", note: "" })).ok, false, "already not known");
  const story = await fixture.prisma.rotaAbsenceUpdate.findMany({ where: { absenceId: id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(story.map((u) => [u.kind, u.lastDay?.toISOString().slice(0, 10) ?? null]), [["reported", null], ["back", tomorrow()], ["extended", addDaysIso(tomorrow(), 4)], ["extended", null]]);
  assert.equal((await fixture.prisma.rotaAbsence.count({ where: { userId: "ava", withdrawnAt: null } })), 1, "an extension is not a new absence");
  const extendedRow = (await data.rotaAbsences()).current[0];
  assert.equal(extendedRow.extensions, 2);
  assert.equal((await actions.endAbsence(id, addDaysIso(tomorrow(), 2))).ok, true);

  // Off again a few days after coming back: a new absence, linked when it is the same thing.
  const again = input("ava", { firstDay: addDaysIso(tomorrow(), 6), continuesId: id });
  assert.equal((await actions.reportAbsence({ ...again, continuesId: "someone-else" })).ok, false);
  assert.equal((await actions.reportAbsence(again)).ok, true);
  const linked = await fixture.prisma.rotaAbsence.findFirstOrThrow({ where: { userId: "ava", continuesId: id } });
  assert.equal(linked.firstDay.toISOString().slice(0, 10), addDaysIso(tomorrow(), 6));
  assert.ok((await data.rotaAbsences()).people.find((p) => p.id === "u:ava")?.absences.length === 2, "the dialog knows their recent absences");
  await fixture.prisma.rotaAbsence.update({ where: { id: linked.id }, data: { withdrawnAt: new Date() } });

  as("noah", [{ ...planner(), scopeId: bishopstown }]);
  assert.equal((await actions.withdrawAbsence(id)).ok, false, "a planner at another site cannot touch it");
  as("maya", [planner()]);
  assert.equal((await actions.withdrawAbsence(id)).ok, true);
  const after = (await data.rotaWeek(churchfield, tomorrow())).days.flatMap((d) => d.shifts).filter((s) => s.userId === "ava");
  assert.ok(after.every((s) => !s.warnings.includes("absent")), "removed absences no longer count");
  as("noah", [{ roleName: "Viewer", permissions: ["rota.view"], screens: ["rota"], scopeKind: "site", scopeId: churchfield }]);
  await assert.rejects(data.rotaAbsences(), /Managing the rota/);
});

test("return to work: due from the first shift back; a fit note is asked for sickness over seven days", () => {
  const back = { lastDay: "2026-10-04", returnMetOn: null };
  assert.equal(returnStage(back, "2026-10-07", "2026-10-06"), "waiting", "before their first shift back");
  assert.equal(returnStage(back, "2026-10-07", "2026-10-07"), "due", "on it");
  assert.equal(returnStage(back, null, "2026-10-05"), "due", "no shift on the rota: due the day after");
  assert.equal(returnStage({ ...back, returnMetOn: "2026-10-07" }, "2026-10-07", "2026-10-09"), "recorded");
  assert.equal(needsFitNote({ reason: "sickness", firstDay: "2026-10-01", lastDay: "2026-10-07" }), false, "seven days: self-certified");
  assert.equal(needsFitNote({ reason: "sickness", firstDay: "2026-10-01", lastDay: "2026-10-08" }), true);
  assert.equal(needsFitNote({ reason: "family", firstDay: "2026-10-01", lastDay: "2026-10-20" }), false, "only sickness");
});

test("return to work: recorded once they are back, it closes the absence and goes on their personal file", async () => {
  await fixture.prisma.user.update({ where: { id: "riley" }, data: { primaryClubId: churchfield } });
  as("maya", [planner()]);
  const firstDay = addDaysIso(today(), -12), lastDay = addDaysIso(today(), -1);
  assert.equal((await actions.reportAbsence({ userId: "riley", reason: "sickness", firstDay, lastDay, note: "" })).ok, true);
  const waiting = (await data.rotaAbsences()).returning.find((a) => a.userId === "riley")!;
  assert.deepEqual([waiting.firstShift, waiting.stage], [tomorrow(), "waiting"], "their first shift back is tomorrow");
  assert.equal(await data.returnsToWorkDue(), 0);
  assert.equal((await actions.saveShift(null, { siteId: churchfield, date: today(), start: "07:00", end: "11:00", role: "Lifeguard", requiredTypeId: "", userId: "riley", note: "", reason: "extra" })).ok, true);
  assert.equal((await data.rotaAbsences()).returning.find((a) => a.userId === "riley")?.stage, "due", "on shift today");
  assert.equal(await data.returnsToWorkDue(), 1, "the home page asks for it");

  const id = waiting.id;
  const answer = { metOn: today(), fit: "adjusted" as const, adjustments: "Shorter shifts for two weeks", fitNote: "yes" as const, note: "Glad to be back" };
  assert.equal((await actions.recordReturnToWork(id, { ...answer, metOn: lastDay })).ok, false, "not on a day they were off");
  assert.equal((await actions.recordReturnToWork(id, { ...answer, metOn: tomorrow() })).ok, false, "not before it happens");
  assert.equal((await actions.recordReturnToWork(id, { ...answer, adjustments: "" })).ok, false, "changes need saying");
  assert.equal((await actions.recordReturnToWork(id, { ...answer, fitNote: "" })).ok, false, "twelve days of sickness needs the fit note answer");
  as("noah", [{ ...planner(), scopeId: bishopstown }]);
  assert.equal((await actions.recordReturnToWork(id, answer)).ok, false, "a planner at another site");
  as("maya", [planner()]);
  assert.equal((await actions.recordReturnToWork(id, answer)).ok, true);
  assert.equal((await actions.recordReturnToWork(id, answer)).ok, false, "only once");
  assert.equal((await actions.extendAbsence(id, { lastDay: "", note: "" })).ok, false, "closed: report a new absence instead");
  assert.equal((await actions.endAbsence(id, today())).ok, false, "closed: not re-dated");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "RotaAbsence", entityId: id, summary: { contains: "return to work" } } });
  assert.doesNotMatch(audit.summary, /sick|shorter|glad/i, "the shared log says neither why nor what was said");

  const page = await data.rotaAbsences();
  assert.ok(!page.returning.some((a) => a.id === id));
  assert.equal(page.returned.find((a) => a.id === id)?.returnFit, "adjusted");

  const file = serverModule<typeof import("./file")>("src/lib/rota/file.ts", doubles());
  const record = await file.absenceFile("riley", ORG);
  assert.equal(record.summary, "1 absence in the last 12 months, 12 calendar days off.");
  assert.match(record.entries[0].title, /^Sickness, .+ \(12 days\)$/);
  assert.match(record.entries[0].detail, /Return to work on .+ with maya: back with changes \(Shorter shifts for two weeks\) · Fit note received · Glad to be back/);
  assert.equal((await file.absenceFile("ava", ORG)).entries.length, 0, "withdrawn absences are not on the file");
});

test("the week plan: a draft until its week starts; after that each change keeps its reason, and Copy last week only fills a week ahead", async () => {
  const db = fixture.prisma;
  await db.department.create({ data: { id: "d-pool", orgId: ORG, name: "Pool", clubId: churchfield } });
  await db.department.create({ data: { id: "d-gym", orgId: ORG, name: "Gym", clubId: bishopstown } });
  as("maya", [planner()]);
  const next = addDaysIso(mondayOf(today()), 7);
  const duty = (date: string, userId: string, extra: Record<string, string> = {}) => ({ siteId: churchfield, date, start: "06:00", end: "14:00", role: "Poolside", departmentId: "d-pool", requiredTypeId: "", userId, note: "", ...extra });
  const logged = await db.rotaShiftChange.count();
  assert.equal((await actions.saveShift(null, duty(next, "ava", { departmentId: "d-gym" }))).ok, false, "another site's department");
  assert.equal((await actions.saveShift(null, duty(next, "ava"))).ok, true, "next week is a draft: no reason needed");
  assert.equal(await db.rotaShiftChange.count(), logged, "nothing logged for a draft");

  const copy = (from: string, to: string, extra: { whole?: boolean; people?: boolean } = {}) => actions.copyPlan({ siteId: churchfield, from, to, whole: true, people: true, ...extra });
  assert.equal((await copy(addDaysIso(mondayOf(today()), -7), mondayOf(today()))).ok, false, "a started week is changed one duty at a time");
  assert.equal((await copy(next, addDaysIso(next, 7))).ok, true);
  const copied = await db.rotaShift.findFirstOrThrow({ where: { date: new Date(`${addDaysIso(next, 7)}T00:00:00Z`), role: "Poolside" } });
  assert.deepEqual([copied.userId, copied.departmentId], ["ava", "d-pool"], "people and departments come too");
  assert.equal((await copy(next, addDaysIso(next, 7))).ok, false, "never doubled: days with a plan are left alone");
  assert.equal((await copy(next, addDaysIso(next, 15), { whole: false, people: false })).ok, true, "one day onto another, the shape only");
  const shape = await db.rotaShift.findFirstOrThrow({ where: { date: new Date(`${addDaysIso(next, 15)}T00:00:00Z`), role: "Poolside" } });
  assert.equal(shape.userId, null, "unfilled");

  // This week has started: Timepoint holds it.
  assert.equal((await actions.reportAbsence({ userId: "ava", reason: "sickness", firstDay: today(), lastDay: today(), note: "" })).ok, true);
  assert.equal((await actions.saveShift(null, duty(today(), "ava"))).ok, false, "a change to a started week needs a reason");
  assert.equal((await actions.saveShift(null, { ...duty(today(), "ava"), reason: "extra" })).ok, true);
  const planned = await db.rotaShift.findFirstOrThrow({ where: { date: new Date(`${today()}T00:00:00Z`), role: "Poolside" } });
  assert.equal((await actions.saveShift(planned.id, { ...duty(today(), "ava"), note: "Bring a whistle" })).ok, true, "only the note: nothing to explain");
  assert.equal((await actions.saveShift(planned.id, { ...duty(today(), "riley"), reason: "cover", changeNote: "Agreed by phone" })).ok, true);
  const cover = await db.rotaShiftChange.findFirstOrThrow({ where: { shiftId: planned.id, kind: "changed" } });
  const absence = await db.rotaAbsence.findFirstOrThrow({ where: { userId: "ava", withdrawnAt: null, firstDay: new Date(`${today()}T00:00:00Z`) } });
  assert.deepEqual([cover.fromUserId, cover.toUserId, cover.absenceId, cover.timepointAt], ["ava", "riley", absence.id, null], "who it moved, and the absence it covers");
  assert.match(cover.before, /Poolside .* ava$/);
  assert.equal(await db.rotaShiftChange.count({ where: { shiftId: planned.id } }), 2, "added and changed, not the note");
  assert.equal((await actions.markTimepointUpdated(cover.id)).ok, true);
  assert.ok((await db.rotaShiftChange.findUniqueOrThrow({ where: { id: cover.id } })).timepointAt, "Timepoint updated");
  assert.equal((await actions.cancelShift(planned.id)).ok, false, "cancelling in a started week needs a reason too");
  assert.equal((await actions.cancelShift(planned.id, { reason: "correction", timepoint: true })).ok, true);
  assert.ok((await db.rotaShiftChange.findFirstOrThrow({ where: { shiftId: planned.id, kind: "cancelled" } })).timepointAt);
  const file = serverModule<typeof import("./file")>("src/lib/rota/file.ts", doubles());
  const ava = await file.dutyChangeFile("ava", ORG);
  assert.ok(ava.entries.some((e) => /^Taken off a duty: Poolside/.test(e.title) && /Covering an absence · by maya/.test(e.detail)), "on the personal file of the person taken off");
  assert.ok((await file.dutyChangeFile("riley", ORG)).entries.some((e) => e.title.startsWith("Put on a duty") && e.detail.endsWith("In Timepoint")));
});

test("booking dates: the chosen weekdays between the first and last day", () => {
  assert.deepEqual(bookingDates("2026-10-05", "2026-10-11", [0, 2, 4]), ["2026-10-05", "2026-10-07", "2026-10-09"], "Monday is 0");
  assert.deepEqual(bookingDates("2026-10-10", "2026-10-10", [5]), ["2026-10-10"], "a one-off Saturday");
  assert.deepEqual(bookingDates("2026-10-06", "2026-10-06", [0]), [], "not on that day");
});

test("bookings: each session's places go on the plan unfilled; cancelling takes off the sessions still to come", async () => {
  const db = fixture.prisma;
  as("maya", [planner()]);
  const next = addDaysIso(mondayOf(today()), 7);
  const input = { siteId: churchfield, kind: "school" as const, title: "Example National School", place: "Learner pool", departmentId: "d-pool",
    weekdays: [0, 1, 2, 3, 4], start: "09:30", end: "11:30", firstDay: next, lastDay: addDaysIso(next, 13), note: "",
    needs: [{ role: "Swim teacher", count: 2, requiredTypeId: "" }, { role: "Lifeguard", count: 1, requiredTypeId: "qt-life" }] };
  assert.equal((await actions.saveBooking({ ...input, firstDay: addDaysIso(today(), -1) })).ok, false, "not in the past");
  assert.equal((await actions.saveBooking({ ...input, siteId: bishopstown })).ok, false, "another site");
  assert.equal((await actions.saveBooking({ ...input, lastDay: addDaysIso(next, 400) })).ok, false, "too many places for one booking");
  assert.equal((await actions.saveBooking(input)).ok, true);
  const booking = await db.rotaBooking.findFirstOrThrow({ where: { title: "Example National School" } });
  const places = await db.rotaShift.findMany({ where: { bookingId: booking.id }, include: { bookingNeed: true } });
  assert.equal(places.length, 10 * 3, "ten sessions, three places each");
  assert.ok(places.every((p) => p.userId === null && p.role === "School lessons: Example National School" && p.departmentId === "d-pool"));
  assert.equal(places.filter((p) => p.bookingNeed?.role === "Lifeguard" && p.requiredTypeId === "qt-life").length, 10);

  const week = await data.rotaWeek(churchfield, next);
  assert.equal(week.days[0].shifts.filter((s) => s.bookingId === booking.id).length, 3, "on the week plan");
  assert.equal((await data.rotaBookings(churchfield)).bookings.find((b) => b.id === booking.id)?.unfilled, 30);

  // A booking running this week, with someone on one of its places today.
  const now = { ...input, title: "Example Swim Club", kind: "lanes" as const, firstDay: today(), lastDay: addDaysIso(today(), 7), weekdays: [0, 1, 2, 3, 4, 5, 6], needs: [{ role: "Lifeguard", count: 1, requiredTypeId: "" }] };
  assert.equal((await actions.saveBooking(now)).ok, true);
  const club = await db.rotaBooking.findFirstOrThrow({ where: { title: "Example Swim Club" } });
  const todays = await db.rotaShift.findFirstOrThrow({ where: { bookingId: club.id, date: new Date(`${today()}T00:00:00Z`) } });
  await db.rotaShift.update({ where: { id: todays.id }, data: { userId: "noah" } });
  assert.equal((await actions.cancelBooking(club.id)).ok, false, "someone this week is on it: say why");
  assert.equal((await actions.cancelBooking(club.id, { reason: "correction", changeNote: "The club cancelled" })).ok, true);
  assert.equal(await db.rotaShift.count({ where: { bookingId: club.id, cancelledAt: null } }), 0, "every session still to come is off the plan");
  assert.equal((await db.rotaShiftChange.findFirstOrThrow({ where: { shiftId: todays.id } })).fromUserId, "noah", "and the person taken off keeps it on their file");
  assert.equal((await actions.cancelBooking(club.id)).ok, false, "already cancelled");
});

test("swim classes: on the plan read-only, and a duty while teaching warns", async () => {
  as("maya", [planner()]);
  const day = addDaysIso(mondayOf(today()), 14);
  classes.push(
    { source: "activities.classes", userId: "ava", siteId: churchfield, date: day, startMinutes: 960, endMinutes: 1005, label: "Level 3", href: `/schedule?date=${day}` },
    { source: "activities.classes", userId: null, siteId: churchfield, date: day, startMinutes: 1020, endMinutes: 1065, label: "Level 1" },
  );
  assert.equal((await actions.saveShift(null, { siteId: churchfield, date: day, start: "12:00", end: "17:00", role: "Lane supervision", departmentId: "d-pool", requiredTypeId: "", userId: "ava", note: "" })).ok, true, "warns, never blocks");
  const week = await data.rotaWeek(churchfield, day);
  const lane = week.days[0].shifts.find((s) => s.role === "Lane supervision")!;
  assert.ok(lane.warnings.includes("teaching"), "Ava teaches at 16:00");
  const plan = buildPlan(week.days);
  const swim = plan.groups.find((g) => g.label === "Swim school")!.rows[0].days[0][0];
  assert.deepEqual([swim.who, swim.text, swim.part, swim.editable, swim.href], ["2 classes · 1 instructor", "16:00–17:45", "1 without an instructor", false, `/schedule?date=${day}`]);
  classes.length = 0;
});

test("copying a plan brings the activities and breaks inside duties, the activities to cover and the day's note", async () => {
  const db = fixture.prisma;
  as("maya", [planner()]);
  const source = addDaysIso(mondayOf(today()), 42), target = addDaysIso(source, 7);
  const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
  await db.rotaShift.create({ data: { orgId: ORG, siteId: churchfield, date: at(source), startMinutes: 360, endMinutes: 840, role: "Poolside", userId: "riley", createdByName: "seed",
    segments: { create: [{ startMinutes: 360, endMinutes: 600, kind: "activity", label: "25m pool lifeguard" }, { startMinutes: 600, endMinutes: 630, kind: "break", label: "Break" }] } } });
  await db.rotaActivity.create({ data: { orgId: ORG, siteId: churchfield, date: at(source), label: "25m pool lifeguard", startMinutes: 390, endMinutes: 1290, people: 1, createdByName: "seed" } });
  await db.rotaDayNote.create({ data: { orgId: ORG, siteId: churchfield, date: at(source), text: "Gala setup from 18:00", byName: "seed" } });
  assert.equal((await actions.copyPlan({ siteId: churchfield, from: source, to: target, whole: true, people: true })).ok, true);
  const copied = await db.rotaShift.findFirstOrThrow({ where: { date: at(target), role: "Poolside" }, include: { segments: { orderBy: { startMinutes: "asc" } } } });
  assert.deepEqual(copied.segments.map((g) => [g.kind, g.label, g.startMinutes]), [["activity", "25m pool lifeguard", 360], ["break", "Break", 600]]);
  assert.equal(copied.userId, "riley");
  assert.equal(await db.rotaActivity.count({ where: { date: at(target), label: "25m pool lifeguard" } }), 1);
  assert.equal((await db.rotaDayNote.findFirstOrThrow({ where: { siteId: churchfield, date: at(target) } })).text, "Gala setup from 18:00");
});

test("breaks by the house rule: entitlement by shift length, placed in free time, paid ones kept in the hours", () => {
  const total = (m: number) => breakEntitlement(m).map((b) => `${b.minutes}${b.paid ? "p" : "u"}`).join(" ");
  assert.equal(total(240), "", "4 hours: none");
  assert.equal(total(241), "15u", "over 4");
  assert.equal(total(359), "15u");
  assert.equal(total(360), "15p 30u", "6 to 8 hours: 45 minutes");
  assert.equal(total(480), "15p 30u 15p", "8 to 10 hours: 60 minutes");
  assert.equal(total(600), "15p 30u 15p");
  assert.equal(total(601), "15p 45u 15p", "over 10 hours: 75 minutes");
  assert.equal(describeEntitlement(540), "60 minutes: 30 unpaid and two 15-minute paid breaks.");

  // 06:00–15:00 (9 hours) with the morning on the 25m pool: breaks avoid it.
  const shift = { startMinutes: 360, endMinutes: 900 };
  const lifeguard = { startMinutes: 360, endMinutes: 600, kind: "activity", label: "25m pool lifeguard" };
  const plan = suggestBreaks(shift, [lifeguard, { startMinutes: 700, endMinutes: 730, kind: "break", label: "Break" }]);
  const breaks = plan.filter((g) => g.kind === "break");
  assert.deepEqual(breaks.map((b) => b.label), [PAID_BREAK, UNPAID_BREAK, PAID_BREAK], "the old break is replaced");
  assert.ok(breaks.every((b) => b.startMinutes >= 600 && b.startMinutes % 15 === 0), "never on the pool, on quarter hours");
  assert.equal(segmentProblem(shift, plan), null, "a valid plan");
  assert.deepEqual([isPaidBreak(breaks[0]), isPaidBreak(breaks[1]), isPaidBreak({ kind: "break", label: "Break" })], [true, false, false]);

  // Planned full: the break cuts into the activity, which then shows a gap.
  const full = suggestBreaks({ startMinutes: 360, endMinutes: 660 }, [{ startMinutes: 360, endMinutes: 660, kind: "activity", label: "Reception" }]);
  assert.deepEqual(full.map((g) => [g.kind, g.startMinutes, g.endMinutes]), [["activity", 360, 510], ["break", 510, 525], ["activity", 525, 660]]);
});

test("under-18s: at least 30 minutes unpaid after 4.5 hours (16 and 17) or 4 hours (under 16)", () => {
  assert.equal(youngBand(null, "2026-10-03"), null);
  assert.equal(youngBand("2010-10-03", "2026-10-03"), "under18", "16 on their birthday");
  assert.equal(youngBand("2010-10-04", "2026-10-03"), "under16", "15 the day before");
  assert.equal(youngBand("2008-10-03", "2026-10-03"), null, "18: the standard rule");
  const total = (m: number, young: "under16" | "under18" | null) => breakEntitlement(m, young).map((b) => `${b.minutes}${b.paid ? "p" : "u"}`).join(" ");
  assert.equal(total(270, "under18"), "15u", "4.5 hours exactly: the standard break");
  assert.equal(total(285, "under18"), "30u", "past 4.5 hours: extended to 30");
  assert.equal(total(255, "under16"), "30u", "under 16, past 4 hours");
  assert.equal(total(240, "under16"), "", "4 hours: none");
  assert.equal(total(480, "under18"), "15p 30u 15p", "already 30 unpaid");
  assert.equal(describeEntitlement(300, "under18"), "30 minutes: 30 unpaid, under-18 minimum included.");
  assert.deepEqual(suggestBreaks({ startMinutes: 540, endMinutes: 840 }, [], "under18").map((g) => [g.label, g.endMinutes - g.startMinutes]), [[UNPAID_BREAK, 30]]);
});
