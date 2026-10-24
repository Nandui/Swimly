import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { actorFrom, can, siteFilter } from "@/lib/policy/engine";
import type { Directory } from "@/lib/policy/types";
import { ALL_PERMISSIONS } from "@/lib/staff/permissions";
import { appPermissions, switchableApps } from "@/modules/registry";
import { appsOffAt, describeSwitch, switchedOn, withAppSwitches, type AppSwitches } from "./switches";

/** App switches (docs/architecture.md, App switches): the rule, the session it shapes, and the
 *  superadmin's screen that changes it. Sites and people are synthetic. */

const RIVERSIDE = "site-riverside", HILLTOP = "site-hilltop";
const switches = (entries: Record<string, { state: "on" | "off" | "sites"; siteIds?: string[] }>): AppSwitches =>
  new Map(Object.entries(entries).map(([app, s]) => [app, { state: s.state, siteIds: s.siteIds ?? [] }]));

test("no row is on everywhere; off is off; some sites is on only there", () => {
  assert.equal(switchedOn(undefined, RIVERSIDE), true);
  assert.equal(switchedOn(undefined, null), true);
  assert.equal(switchedOn({ state: "on", siteIds: [] }, RIVERSIDE), true);
  assert.equal(switchedOn({ state: "off", siteIds: [] }, RIVERSIDE), false);
  assert.equal(switchedOn({ state: "off", siteIds: [] }, null), false);
  const one = { state: "sites" as const, siteIds: [RIVERSIDE] };
  assert.equal(switchedOn(one, RIVERSIDE), true);
  assert.equal(switchedOn(one, HILLTOP), false);
  assert.equal(switchedOn(one, null), true, "without a site, on somewhere is on");
  assert.equal(switchedOn({ state: "sites", siteIds: [] }, null), false);
});

test("the apps off at a site, and the switch in words", () => {
  const set = switches({ rota: { state: "off" }, stock: { state: "sites", siteIds: [RIVERSIDE] }, docs: { state: "on" } });
  assert.deepEqual(appsOffAt(set, RIVERSIDE), ["rota"]);
  assert.deepEqual(appsOffAt(set, HILLTOP), ["rota", "stock"]);
  assert.equal(describeSwitch("on", []), "On everywhere");
  assert.equal(describeSwitch("off", []), "Off");
  assert.equal(describeSwitch("sites", ["Riverside", "Hilltop"]), "On at Riverside, Hilltop only");
});

test("Admin is never switchable, and every app's permissions are its own", () => {
  const ids = switchableApps().map((m) => m.id);
  assert.ok(!ids.includes("admin"));
  assert.ok(!appPermissions(ids).has("staff.manage"), "switching every app off leaves Admin's permissions");
  for (const id of ids) {
    const mine = appPermissions([id]);
    const others = appPermissions(ids.filter((other) => other !== id));
    for (const key of mine) assert.ok(!others.has(key), `${key} belongs to ${id} only`);
  }
});

const grant = (scopeKind: string, scopeId: string, permissions: string[]) => ({ roleName: "Synthetic role", scopeKind, scopeId, permissions });

test("the session loses an app's permissions where it is off, and keeps every other app's", () => {
  const user = {
    permissions: ["rota.view", "docs.read", "stock.read"],
    primaryPermissions: ["docs.read", "stock.read"],
    grants: [grant("site", RIVERSIDE, ["rota.view"]), grant("site", HILLTOP, ["rota.view"]), grant("reports", "", ["hr.records.read"])],
  };
  const set = switches({ rota: { state: "sites", siteIds: [HILLTOP] }, hr: { state: "off" } });
  const atRiverside = withAppSwitches(user, set, RIVERSIDE);
  assert.deepEqual(atRiverside.appsOff, ["rota", "hr"]);
  assert.deepEqual(atRiverside.permissions, ["docs.read", "stock.read"]);
  assert.deepEqual(atRiverside.primaryPermissions, ["docs.read", "stock.read"]);
  assert.deepEqual(atRiverside.grants.map((g) => g.scopeId), [HILLTOP], "the Hilltop grant keeps the rota; the team grant loses HR");
  const atHilltop = withAppSwitches(user, set, HILLTOP);
  assert.deepEqual(atHilltop.permissions, ["rota.view", "docs.read", "stock.read"]);
  assert.deepEqual(withAppSwitches(user, new Map(), RIVERSIDE), { ...user, appsOff: [] }, "no switches change nothing");
});

function authz() {
  return serverModule<typeof import("@/lib/authz")>("src/lib/authz.ts", { "@/auth": { auth: async () => null }, "server-only": {} });
}
const sessionOf = (user: { permissions: string[]; isSuperadmin?: boolean; appsOff?: string[] }) => ({ user: { id: "u1", roleId: "r1", roleName: "Synthetic role", ...user } }) as never;

test("an administrator and a superadmin lose a switched-off app too, and nothing else", () => {
  const { permissionsOf, canSee } = authz();
  const admin = permissionsOf(sessionOf({ permissions: ["staff.manage", "roles.manage"], appsOff: ["rota"] }));
  assert.ok(!admin.has("rota.view") && !admin.has("rota.manage"));
  assert.ok(admin.has("docs.read") && admin.has("staff.manage"));
  const superadmin = sessionOf({ permissions: [], isSuperadmin: true, appsOff: ["hr"] });
  assert.ok(!permissionsOf(superadmin).has("hr.records.read"));
  assert.equal(canSee(superadmin, "hr"), false, "the page answers not found");
  assert.equal(canSee(superadmin, "rota"), true);
});

test("the policy engine refuses a switched-off app's records, superadmin or not", async () => {
  const dir: Directory = { reportsOf: async () => new Set(), sitesOf: async () => new Set(), membersOfSites: async () => new Set(), orgMembers: async () => new Set(["someone"]) };
  const withheld = appPermissions(["hr"]);
  const superadmin = actorFrom({ id: "u1", name: "Synthetic", orgId: "org", superadmin: true, primary: { name: "Role", permissions: [] }, assignments: [], withheld });
  assert.equal(await can(superadmin, "hr.records.read", { orgId: "org", subjectUserId: "someone" }, dir), false);
  assert.equal(await can(superadmin, "training.records.read", { orgId: "org", subjectUserId: "someone" }, dir), true);
  assert.equal(await can(superadmin, "training.records.read", { orgId: "other-org", subjectUserId: "someone" }, dir), false, "never another organisation");
  const lead = actorFrom({ id: "u2", name: "Synthetic", orgId: "org", superadmin: false, primary: null, assignments: [{ roleName: "Role", permissions: ["rota.view"], scope: { kind: "site", id: RIVERSIDE } }], withheld: appPermissions(["rota"]) });
  assert.deepEqual(await siteFilter(lead, "rota.view"), { kind: "some", siteIds: new Set() });
  const everything = actorFrom({ id: "u3", name: "Synthetic", orgId: "org", superadmin: true, primary: { name: "Role", permissions: [] }, assignments: [] });
  assert.equal(everything.superadmin, true, "with nothing switched off a superadmin keeps the bypass");
  assert.equal(everything.grants[0].permissions.size, ALL_PERMISSIONS.length);
});

// ---------------------------------------------------------------------------
// Admin › Apps: the superadmin's switch, against an in-memory Postgres
// ---------------------------------------------------------------------------

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
const ORG = "org_leisureworld";
const who = { superadmin: true };

before(async () => {
  fixture = await isolatedPrisma();
  await fixture.prisma.club.createMany({ data: [
    { id: RIVERSIDE, name: "Synthetic Riverside", orgId: ORG },
    { id: HILLTOP, name: "Synthetic Hilltop", orgId: ORG },
  ] });
  await fixture.prisma.organisation.create({ data: { id: "org-other", name: "Other", slug: "other" } });
  await fixture.prisma.club.create({ data: { id: "site-elsewhere", name: "Synthetic Elsewhere", orgId: "org-other" } });
  await fixture.prisma.user.create({ data: { id: "boss", name: "Synthetic Boss", email: "boss@example.invalid", orgId: ORG, isSuperadmin: true } });
  const session = () => ({ user: { id: "boss", name: "Synthetic Boss", orgId: ORG, isSuperadmin: who.superadmin, permissions: ["staff.manage", "roles.manage"] } });
  actions = serverModule("src/lib/apps/actions.ts", {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": { requireSession: async () => session() },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
  });
});
after(async () => { await fixture?.close(); });

const audit = () => fixture.prisma.auditLog.findMany({ where: { entity: "AppSwitch" }, orderBy: { createdAt: "asc" }, select: { summary: true, module: true, clubId: true, actorId: true } });

test("only a superadmin switches an app, and nothing is written when refused", async () => {
  who.superadmin = false;
  try {
    const refused = await actions.setAppSwitch({ appId: "rota", state: "off", siteIds: [] });
    assert.deepEqual(refused, { ok: false, error: "Only a superadmin can switch apps on or off." });
    assert.equal(await fixture.prisma.appSwitch.count(), 0);
  } finally { who.superadmin = true; }
});

test("switching off, to one site and back on writes the switch and one audit row each", async () => {
  assert.deepEqual(await actions.setAppSwitch({ appId: "rota", state: "off", siteIds: [] }), { ok: true });
  assert.deepEqual(await actions.setAppSwitch({ appId: "rota", state: "sites", siteIds: [RIVERSIDE] }), { ok: true });
  assert.deepEqual(await actions.setAppSwitch({ appId: "rota", state: "sites", siteIds: [RIVERSIDE] }), { ok: true }, "the same again changes nothing");
  assert.deepEqual(await actions.setAppSwitch({ appId: "rota", state: "on", siteIds: [HILLTOP] }), { ok: true });
  const row = await fixture.prisma.appSwitch.findUniqueOrThrow({ where: { orgId_appId: { orgId: ORG, appId: "rota" } } });
  assert.equal(row.state, "on");
  assert.deepEqual(row.siteIds, [], "sites are kept only for some sites");
  assert.equal(row.updatedById, "boss");
  assert.deepEqual(await audit(), [
    { summary: "Rota: Off (was On everywhere)", module: "Admin", clubId: null, actorId: "boss" },
    { summary: "Rota: On at Synthetic Riverside only (was Off)", module: "Admin", clubId: null, actorId: "boss" },
    { summary: "Rota: On everywhere (was On at Synthetic Riverside only)", module: "Admin", clubId: null, actorId: "boss" },
  ]);
});

test("refuses Admin, an unknown app, no sites, and another organisation's site", async () => {
  assert.equal((await actions.setAppSwitch({ appId: "admin", state: "off", siteIds: [] })).ok, false);
  assert.equal((await actions.setAppSwitch({ appId: "nothing", state: "off", siteIds: [] })).ok, false);
  assert.deepEqual(await actions.setAppSwitch({ appId: "stock", state: "sites", siteIds: [] }), { ok: false, error: "Tick at least one site, or switch the app off." });
  assert.deepEqual(await actions.setAppSwitch({ appId: "stock", state: "sites", siteIds: ["site-elsewhere"] }), { ok: false, error: "Choose from your sites." });
  assert.equal(await fixture.prisma.appSwitch.count({ where: { appId: { in: ["admin", "nothing", "stock"] } } }), 0);
});

