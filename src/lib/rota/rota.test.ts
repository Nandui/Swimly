import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { absentOn, addDaysIso, mondayOf, parseClock, shiftWarnings } from "./constants";
import { today } from "@/lib/format";

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
  const shift = (siteId: string, userId: string, start = "07:00", end = "15:00") => ({ siteId, date: tomorrow(), start, end, role: "Lifeguard", requiredTypeId: "qt-life", userId, note: "" });
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
  assert.equal((await actions.cancelShift(shift.id)).ok, false);
  as("maya", [planner()]);
  assert.equal((await actions.cancelShift(shift.id)).ok, true);
  assert.equal((await actions.cancelShift(shift.id)).ok, false);
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

  as("noah", [{ ...planner(), scopeId: bishopstown }]);
  assert.equal((await actions.withdrawAbsence(id)).ok, false, "a planner at another site cannot touch it");
  as("maya", [planner()]);
  assert.equal((await actions.withdrawAbsence(id)).ok, true);
  const after = (await data.rotaWeek(churchfield, tomorrow())).days.flatMap((d) => d.shifts).filter((s) => s.userId === "ava");
  assert.ok(after.every((s) => !s.warnings.includes("absent")), "removed absences no longer count");
  as("noah", [{ roleName: "Viewer", permissions: ["rota.view"], screens: ["rota"], scopeKind: "site", scopeId: churchfield }]);
  await assert.rejects(data.rotaAbsences(), /Managing the rota/);
});
