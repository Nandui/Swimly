import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { joinLocation, splitLocation } from "./meta";

/** Admin's shared setup (docs/admin-setup.md): the activity list and each site's areas need
 *  their own permission, and renaming an area reaches the records that use it. Invented data. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
const ORG = "org_leisureworld";
const state = { id: "ana", permissions: [] as string[] };
let site = "";

class Denied extends Error {}
function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, permissions: state.permissions } };
}
const as = (id: string, permissions: string[]) => Object.assign(state, { id, permissions });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  site = (await db.club.findFirstOrThrow({ where: { orgId: ORG, name: { contains: "Bishopstown" } } })).id;
  await db.department.create({ data: { id: "d-pool", orgId: ORG, name: "Pool" } });
  await db.user.create({ data: { id: "ana", name: "ana", email: "ana@example.invalid", orgId: ORG } });
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      requireSession: async () => session(),
      can: (_s: unknown, p: PermissionKey) => expandPermissions(state.permissions).has(p),
    },
    "@/lib/clubs/current": { currentClubId: async () => site, currentClubIdIfAny: async () => site },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
  };
  // The rename runs through the modules' registered handlers, as in the app.
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", doubles);
  serverModule("src/lib/rota/areas.ts", { ...doubles, "@/modules/contributions": contributions });
  actions = serverModule("src/lib/setup/actions.ts", { ...doubles, "@/modules/server": { renameAreaEverywhere: contributions.renameAreaEverywhere } });
});
after(async () => { await fixture?.close(); });

test("the activity list is kept with its own permission; names are unique; one activity takes the classes", async () => {
  as("ana", ["setup.view"]);
  await assert.rejects(actions.saveActivityType(null, { name: "Lifeguarding", departmentId: "d-pool", icon: "lifeguard" }), Denied, "seeing the setup is not keeping it");
  as("ana", ["setup.activities"]);
  assert.equal((await actions.saveActivityType(null, { name: "Lifeguarding", departmentId: "d-pool", icon: "lifeguard" })).ok, true);
  assert.equal((await actions.saveActivityType(null, { name: "lifeguarding", departmentId: "d-pool", icon: "lifeguard" })).ok, false, "names are unique");
  assert.equal((await actions.saveActivityType(null, { name: "Teaching", departmentId: "d-pool", icon: "teaching", fromClasses: true })).ok, true);
  assert.equal((await actions.saveActivityType(null, { name: "Squad coaching", departmentId: "d-pool", icon: "teaching", fromClasses: true })).ok, false, "one activity takes the classes");
  const lg = await fixture.prisma.activityType.findFirstOrThrow({ where: { name: "Lifeguarding" } });
  assert.equal((await actions.archiveActivityType(lg.id, true)).ok, true);
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "ActivityType", action: "create" } });
  assert.equal(log.module, "Admin");
});

test("areas: added in order, no duplicates or commas; a rename reaches the rota's records", async () => {
  as("ana", ["setup.view"]);
  await assert.rejects(actions.saveArea(site, null, { name: "25m pool" }), Denied);
  as("ana", ["setup.areas"]);
  assert.equal((await actions.saveArea(site, null, { name: "25m pool" })).ok, true);
  assert.equal((await actions.saveArea(site, null, { name: "Learner pool" })).ok, true);
  assert.equal((await actions.saveArea(site, null, { name: "25M Pool" })).ok, false, "one of each name at a site");
  assert.equal((await actions.saveArea(site, null, { name: "Pool, lane 3" })).ok, false, "the lane is a class's detail, not an area");
  const areas = await fixture.prisma.siteArea.findMany({ where: { siteId: site }, orderBy: { sortOrder: "asc" } });
  assert.deepEqual(areas.map((a) => a.name), ["25m pool", "Learner pool"]);
  assert.equal((await actions.moveArea(areas[1].id, "up")).ok, true);
  assert.deepEqual((await fixture.prisma.siteArea.findMany({ where: { siteId: site }, orderBy: { sortOrder: "asc" } })).map((a) => a.name), ["Learner pool", "25m pool"]);

  const type = await fixture.prisma.activityType.findFirstOrThrow({ where: { name: "Teaching" } });
  await fixture.prisma.rotaNeed.create({ data: { orgId: ORG, siteId: site, date: new Date("2026-10-20T00:00:00Z"), typeId: type.id, place: "Learner pool", startMinutes: 900, endMinutes: 960, places: 1, createdByName: "Test" } });
  assert.equal((await actions.saveArea(site, areas[1].id, { name: "Teaching pool" })).ok, true);
  assert.equal((await fixture.prisma.rotaNeed.findFirstOrThrow({ where: { siteId: site } })).place, "Teaching pool", "the plan follows the rename");
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "SiteArea", action: "update" } });
  assert.match(log.summary, /Renamed .* Learner pool to Teaching pool, and 1 record/);
});

test("a swim class's location is an area and a detail", () => {
  assert.deepEqual(splitLocation("Learner pool, lane 3", ["Learner pool", "Main pool"]), { area: "Learner pool", detail: "lane 3" });
  assert.deepEqual(splitLocation("learner pool", ["Learner pool"]), { area: "Learner pool", detail: "" });
  assert.deepEqual(splitLocation("Somewhere else", ["Learner pool"]), { area: "", detail: "Somewhere else" }, "older text is kept as the detail");
  assert.equal(joinLocation("Learner pool", " lane 3 "), "Learner pool, lane 3");
  assert.equal(joinLocation("", "Main pool"), "Main pool");
});
