import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Maintenance end to end on an isolated database, with invented people and problems: reporting
 *  at your own sites only, once per form, starting In Trackplan when it already is; managers' moves
 *  at their sites only, version-checked and replay-safe; the lists, Home items, photos, subject
 *  records and area renames; and an audit row with every change. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let report: typeof import("../features/report/server/actions");
let nearby: typeof import("../features/report/server/nearby");
let moves: typeof import("../features/requests/server/actions");
let data: typeof import("../features/requests/server/data");
let home: typeof import("../features/requests/server/home");
let people: typeof import("../features/requests/server/people");
let photos: typeof import("../features/photos/server/photos");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "lena", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["maintenance"], primaryScreens: ["maintenance"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, grants: GrantRow[], permissions: string[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, ...permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["maintenance"], scopeKind: "site", scopeId: siteId });
const uuid = () => crypto.randomUUID();
const problem = (siteId: string, extra: Record<string, string> = {}) => ({
  id: uuid(), operationId: uuid(), siteId, area: "Changing village", place: "Shower 3", title: "Shower will not turn off", details: "",
  urgency: "normal" as const, risk: "none" as const, trackplan: "unsure" as const, trackplanRef: "", ...extra,
});
const row = (id: string) => fixture.prisma.maintenanceRequest.findUniqueOrThrow({ where: { id } });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  for (const siteId of [bishopstown, churchfield]) {
    await db.siteArea.create({ data: { orgId: ORG, siteId, name: "Changing village" } });
    await db.siteArea.create({ data: { orgId: ORG, siteId, name: "Gym" } });
  }
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["lena", "tom", "mia", "sam"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG } });
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
  report = serverModule("src/modules/maintenance/features/report/server/actions.ts", d);
  nearby = serverModule("src/modules/maintenance/features/report/server/nearby.ts", d);
  moves = serverModule("src/modules/maintenance/features/requests/server/actions.ts", d);
  data = serverModule("src/modules/maintenance/features/requests/server/data.ts", d);
  home = serverModule("src/modules/maintenance/features/requests/server/home.ts", d);
  people = serverModule("src/modules/maintenance/features/requests/server/people.ts", d);
  photos = serverModule("src/modules/maintenance/features/photos/server/photos.ts", d);
});
after(async () => { await fixture?.close(); });

const reporter = () => as("lena", [at(bishopstown, "maintenance.report")]);
const manager = () => as("mia", [at(bishopstown, "maintenance.manage")]);
let first = "", second = "";

test("staff report at their own sites only, and sending the same form twice saves once", async () => {
  reporter();
  const input = problem(bishopstown);
  assert.deepEqual(await report.reportProblem(input), { ok: true, id: input.id });
  assert.deepEqual(await report.reportProblem(input), { ok: true, id: input.id }, "a second press of Send");
  assert.equal(await fixture.prisma.maintenanceRequest.count(), 1);
  const saved = await row(input.id);
  assert.equal(saved.status, "reported");
  assert.equal(saved.reportedByName, "lena");
  assert.equal(saved.orgId, ORG);
  first = input.id;
  assert.equal((await report.reportProblem(problem(churchfield))).ok, false, "a site the role does not cover");
  assert.equal((await report.reportProblem(problem(bishopstown, { area: "Car park" }))).ok, false, "an area not on the site's list");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "MaintenanceRequest" } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].module, "Maintenance");
  assert.equal(audit[0].clubId, bishopstown);
});

test("already in Trackplan starts In Trackplan with its reference; could hurt someone is urgent", async () => {
  reporter();
  const input = problem(bishopstown, { area: "Gym", place: "", title: "Treadmill belt torn", risk: "could_hurt", urgency: "low", trackplan: "yes", trackplanRef: "TP-1182" });
  assert.equal((await report.reportProblem(input)).ok, true);
  const saved = await row(input.id);
  assert.equal(saved.status, "in_trackplan");
  assert.equal(saved.trackplanRef, "TP-1182");
  assert.equal(saved.urgency, "urgent");
  second = input.id;
  const noRef = problem(bishopstown, { trackplan: "no", trackplanRef: "TP-9" });
  await report.reportProblem(noRef);
  assert.equal((await row(noRef.id)).trackplanRef, "", "a reference only with a yes");
});

test("the form lists what is already open in the area, at the person's own sites only", async () => {
  reporter();
  const open = await nearby.openInArea(bishopstown, "changing village");
  assert.equal(open.length, 2);
  assert.ok(open.every((r) => r.number.startsWith("M-")));
  assert.deepEqual(await nearby.openInArea(churchfield, "Changing village"), [], "a site the role does not cover");
});

test("lists hold the person's sites only; managers get what is still to put in Trackplan, urgent first", async () => {
  as("sam", [at(churchfield, "maintenance.report")]);
  await report.reportProblem(problem(churchfield, { title: "Locker door hanging off" }));
  reporter();
  const mine = await data.maintenanceLists({});
  assert.equal(mine.show, "open");
  assert.deepEqual(mine.views, ["open", "mine", "closed"], "no Trackplan list without Manage");
  assert.equal(mine.counts.open, 3);
  assert.ok(mine.rows.every((r) => r.siteId === bishopstown));
  assert.equal(mine.rows[0].id, second, "urgent first");
  manager();
  const theirs = await data.maintenanceLists({});
  assert.equal(theirs.show, "trackplan");
  assert.equal(theirs.counts.trackplan, 2);
  as("tom", [], ["maintenance.manage"]);
  assert.equal((await data.maintenanceLists({ show: "open" })).counts.open, 4, "everywhere, every site");
});

test("only Manage at the request's site moves it, and each move is checked against where it is", async () => {
  const r = await row(first);
  reporter();
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: r.version, move: "trackplan" })).ok, false, "Report cannot move it");
  as("mia", [at(churchfield, "maintenance.manage")]);
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: r.version, move: "trackplan" })).ok, false, "another site's request");
  manager();
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: r.version + 5, move: "trackplan" })).ok, false, "changed meanwhile");
  const op = uuid();
  assert.deepEqual(await moves.moveRequest({ id: first, operationId: op, version: r.version, move: "trackplan", trackplanRef: "TP-2001" }), { ok: true, id: first });
  assert.deepEqual(await moves.moveRequest({ id: first, operationId: op, version: r.version, move: "trackplan", trackplanRef: "TP-2001" }), { ok: true, id: first }, "a second press lands once");
  const moved = await row(first);
  assert.equal(moved.status, "in_trackplan");
  assert.equal(moved.trackplanRef, "TP-2001");
  assert.equal(moved.version, r.version + 1);
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: moved.version, move: "close" })).ok, false, "closing needs a reason");
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: moved.version, move: "fix", note: "Valve replaced" })).ok, true);
  const fixed = await row(first);
  assert.equal(fixed.status, "fixed");
  assert.equal(fixed.outcome, "Valve replaced");
  assert.equal(fixed.closedByName, "mia");
  assert.equal((await moves.moveRequest({ id: first, operationId: uuid(), version: fixed.version, move: "reopen", note: "Dripping again" })).ok, true);
  assert.equal((await row(first)).status, "in_trackplan", "back where its Trackplan answer puts it");
  const history = await fixture.prisma.maintenanceEvent.findMany({ where: { requestId: first }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(history.map((e) => e.action), ["report", "trackplan", "fix", "reopen"]);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: first } }), 4);
});

test("a duplicate points to another open request at the same site, never one elsewhere", async () => {
  manager();
  const dup = await fixture.prisma.maintenanceRequest.findFirstOrThrow({ where: { siteId: bishopstown, trackplan: "no" } });
  const elsewhere = await fixture.prisma.maintenanceRequest.findFirstOrThrow({ where: { siteId: churchfield } });
  assert.equal((await moves.moveRequest({ id: dup.id, operationId: uuid(), version: dup.version, move: "close", duplicateOfId: elsewhere.id })).ok, false);
  assert.equal((await moves.moveRequest({ id: dup.id, operationId: uuid(), version: dup.version, move: "close", duplicateOfId: first })).ok, true);
  const closed = await row(dup.id);
  assert.equal(closed.status, "closed");
  assert.equal(closed.duplicateOfId, first);
});

test("correcting the Trackplan answer moves an open request with it, and says what changed", async () => {
  manager();
  const r = await row(second);
  const fields = { area: r.area, place: r.place, title: r.title, details: r.details, urgency: r.urgency as "urgent", risk: r.risk as "could_hurt", trackplanRef: "" };
  assert.equal((await moves.correctRequest({ id: second, operationId: uuid(), version: r.version, ...fields, trackplan: "yes", trackplanRef: r.trackplanRef })).ok, false, "nothing changed");
  assert.equal((await moves.correctRequest({ id: second, operationId: uuid(), version: r.version, ...fields, trackplan: "no", risk: "out_of_use", urgency: "low" })).ok, true);
  const fixed = await row(second);
  assert.equal(fixed.status, "reported");
  assert.equal(fixed.urgency, "low", "no longer a risk to anyone, so the urgency chosen stands");
  const note = await fixture.prisma.maintenanceEvent.findFirstOrThrow({ where: { requestId: second, action: "correct" } });
  assert.match(note.note, /urgency/);
  assert.match(note.note, /Trackplan answer/);
});

test("Home: managers see what is still to put in Trackplan; everyone gets the report action", async () => {
  manager();
  const viewer = (perms: string[]) => ({ id: state.id, name: state.id, permissions: perms, anywhere: perms, isSuperadmin: false });
  const items = await home.maintenanceHomeItems(viewer(["maintenance.manage"]));
  const queue = items.find((i) => i.href === "/maintenance?show=trackplan");
  assert.equal(queue?.count, 1);
  assert.equal(queue?.attention, true);
  assert.ok(items.some((i) => i.kind === "action" && i.href === "/maintenance/new"));
  reporter();
  const own = await home.maintenanceHomeItems(viewer(["maintenance.report"]));
  assert.equal(own.find((i) => i.href === "/maintenance?show=mine")?.attention, undefined, "the starter page only: nothing waits on them");
  assert.ok(!own.some((i) => i.href === "/maintenance?show=trackplan"));
  assert.deepEqual(await home.maintenanceHomeItems(viewer([])), []);
});

test("photos: the reporter or a manager adds them to an open request, shrunk and without camera details", async () => {
  const big = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: { r: 120, g: 120, b: 128 } } }).withMetadata({ exif: { IFD0: { Artist: "Lena" } } }).jpeg().toBuffer();
  const file = (name = "leak.jpg", bytes: Uint8Array = big) => new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
  as("sam", [at(bishopstown, "maintenance.report")]);
  await assert.rejects(photos.addPhoto({ id: "sam", name: "sam", orgId: ORG, superadmin: false, manage: false }, second, file()), /whoever reported it/, "someone else's report");
  reporter();
  const lena = { id: "lena", name: "lena", orgId: ORG, superadmin: false, manage: false };
  await assert.rejects(photos.addPhoto(lena, second, file("leak.jpg", new TextEncoder().encode("<svg/>"))), /Use a photo/);
  await photos.addPhoto(lena, second, file());
  const kept = await fixture.prisma.maintenancePhoto.findFirstOrThrow({ where: { requestId: second } });
  assert.equal(kept.mime, "image/webp");
  assert.equal(kept.name, "leak.webp");
  const meta = await sharp(kept.bytes).metadata();
  assert.equal(meta.width, 2000, "shrunk to 2000px on its longer side");
  assert.equal(meta.exif, undefined, "no camera details");
  await photos.addPhoto(lena, second, file());
  await photos.addPhoto(lena, second, file());
  await assert.rejects(photos.addPhoto(lena, second, file()), /up to 3 photos/);
  as("tom", [at(churchfield, "maintenance.report")]);
  await assert.rejects(photos.readPhoto({ id: "tom", name: "tom", orgId: ORG, superadmin: false, manage: false }, kept.id), /not available/, "a site the role does not cover");
  reporter();
  await photos.removePhoto(lena, kept.id);
  assert.ok((await fixture.prisma.maintenancePhoto.findUniqueOrThrow({ where: { id: kept.id } })).removedAt, "hidden, never deleted");
  await assert.rejects(photos.readPhoto(lena, kept.id), /not available/);
});

test("a person's subject records list what they reported; an area rename reaches the requests", async () => {
  const records = await people.maintenanceSubjectRecords("lena", ORG);
  assert.equal(records.length, 3);
  assert.ok(records.every((r) => r.site.includes("Bishopstown") && r.request.startsWith("M-")));
  assert.equal(await people.renameMaintenanceAreas({ siteId: bishopstown, from: "Changing village", to: "Village changing" }), 2);
  assert.equal((await row(first)).area, "Village changing");
  assert.equal((await fixture.prisma.maintenanceRequest.findFirstOrThrow({ where: { siteId: churchfield } })).area, "Changing village", "another site's area of the same name stays");
});
