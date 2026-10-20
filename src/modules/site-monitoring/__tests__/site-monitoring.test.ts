import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Site Monitoring end to end on an isolated database: a task completed with readings out of
 *  range raises one action per reading, once; managers see only their sites' actions; closing
 *  needs Act at the site and says what was done; opening again clears it; every change is
 *  audited. Invented people and readings. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let raise: typeof import("../features/actions/server/raise");
let data: typeof import("../features/actions/server/data");
let actions: typeof import("../features/actions/server/actions");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "mia", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["site-monitoring"], primaryScreens: ["site-monitoring"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["site-monitoring"], scopeKind: "site", scopeId: siteId });

const reading = (siteId: string, taskId: string, value: string) => ({
  orgId: ORG, siteId, taskId, task: "Pool water test", recordedById: "lena", recordedByName: "Lena", recordedAt: new Date().toISOString(),
  readings: [
    { key: "0:chlorine", reading: "Free chlorine", value, unit: "mg/L", allowed: "1 to 3", guidance: "Check dosing and retest." },
    { key: "0:ph", reading: "pH", value: "8.1", unit: "", allowed: "7.2 to 7.6", guidance: "" },
  ],
});

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-manager", name: "Manager", permissions: [], screens: [] } });
  for (const id of ["mia", "tom", "lena"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-manager", orgId: ORG } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  raise = serverModule("src/modules/site-monitoring/features/actions/server/raise.ts", d);
  data = serverModule("src/modules/site-monitoring/features/actions/server/data.ts", d);
  actions = serverModule("src/modules/site-monitoring/features/actions/server/actions.ts", d);
});
after(async () => { await fixture?.close(); });

test("a task completed out of range raises one action per reading, once", async () => {
  assert.equal(await raise.raiseFromTaskReadings(reading(bishopstown, "task-1", "0.4")), 2);
  assert.equal(await raise.raiseFromTaskReadings(reading(bishopstown, "task-1", "0.4")), 0, "the same readings announced again raise nothing new");
  assert.equal(await raise.raiseFromTaskReadings(reading(churchfield, "task-2", "0.6")), 2);
  const one = await fixture.prisma.monitoringAction.findFirstOrThrow({ where: { siteId: bishopstown, reading: "Free chlorine" } });
  assert.equal(one.status, "open");
  assert.equal(one.sourceHref, "/tasks/task-1");
  assert.equal(one.allowed, "1 to 3");
  assert.equal(one.recordedByName, "Lena");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "MonitoringAction" } });
  assert.equal(audit.length, 4);
  assert.ok(audit.every((a) => a.module === "Site Monitoring"));
});

test("managers see their own sites' actions only", async () => {
  as("mia", [], [at(bishopstown, ["site-monitoring.read"])]);
  const seen = await data.monitoringActions();
  assert.equal(seen.open.length, 2);
  assert.ok(seen.open.every((a) => a.siteId === bishopstown && !a.act), "View cannot close");
  as("tom", ["site-monitoring.act"]);
  assert.equal((await data.monitoringActions()).open.length, 4, "everywhere, every site");
});

test("closing needs Act at the site and says what was done; opening again clears it", async () => {
  const one = await fixture.prisma.monitoringAction.findFirstOrThrow({ where: { siteId: bishopstown, reading: "Free chlorine" } });
  as("mia", [], [at(bishopstown, ["site-monitoring.read"])]);
  assert.equal((await actions.setMonitoringActionClosed(one.id, true, "Dosing adjusted")).ok, false, "View cannot close");
  as("mia", [], [at(churchfield, ["site-monitoring.act"])]);
  assert.equal((await actions.setMonitoringActionClosed(one.id, true, "Dosing adjusted")).ok, false, "another site's action");
  as("mia", [], [at(bishopstown, ["site-monitoring.act"])]);
  assert.equal((await actions.setMonitoringActionClosed(one.id, true, "")).ok, false, "say what was done");
  assert.equal((await actions.setMonitoringActionClosed(one.id, true, "Dosing adjusted, retested at 14:10, 1.8 mg/L")).ok, true);
  assert.equal((await actions.setMonitoringActionClosed(one.id, true, "Again")).ok, false, "already closed");
  const closed = await fixture.prisma.monitoringAction.findUniqueOrThrow({ where: { id: one.id } });
  assert.equal(closed.status, "closed");
  assert.equal(closed.closedByName, "mia");
  const seen = await data.monitoringActions();
  assert.equal(seen.open.length, 1);
  assert.equal(seen.closed[0].resolution, "Dosing adjusted, retested at 14:10, 1.8 mg/L");
  assert.equal((await actions.setMonitoringActionClosed(one.id, false, "")).ok, true);
  const reopened = await fixture.prisma.monitoringAction.findUniqueOrThrow({ where: { id: one.id } });
  assert.equal(reopened.status, "open");
  assert.equal(reopened.resolution, "");
  assert.deepEqual((await fixture.prisma.auditLog.findMany({ where: { entityId: one.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action), ["create", "resolve", "reopen"]);
});
