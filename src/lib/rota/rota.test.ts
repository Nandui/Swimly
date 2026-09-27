import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { addDaysIso, mondayOf, parseClock, shiftWarnings } from "./constants";
import { today } from "@/lib/format";

/** The Rota: a site-scoped planner plans only their site, qualification gaps
 *  and double-bookings warn but never refuse, and each person sees only their
 *  own shifts. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
let data: typeof import("./data");
let my: typeof import("@/modules/rota/my");
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
  my = serverModule("src/modules/rota/my.ts", d);
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
  const riley = await my.rotaMine.load({ userId: "riley", orgId: ORG, session: session() as never });
  assert.equal(riley.length, 1);
  assert.equal(riley[0].status?.label, "Qualification expired");
  assert.equal(riley[0].needsAction, true);
  const ava = await my.rotaMine.load({ userId: "ava", orgId: ORG, session: session() as never });
  assert.equal(ava.length, 2);
  assert.ok(ava.every((i) => !i.needsAction), "double-bookings are the planner's to fix");
});

test("cancelling needs the permission at that site", async () => {
  const shift = await fixture.prisma.rotaShift.findFirstOrThrow({ where: { userId: "noah" } });
  as("noah", [{ ...planner(), scopeId: bishopstown }]);
  assert.equal((await actions.cancelShift(shift.id)).ok, false);
  as("maya", [planner()]);
  assert.equal((await actions.cancelShift(shift.id)).ok, true);
  assert.equal((await actions.cancelShift(shift.id)).ok, false);
});
