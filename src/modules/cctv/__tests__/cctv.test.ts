import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { today } from "@/lib/format";
import { parseIncidentNumber, viewingProblem, viewingSchema, type ViewingInput } from "@/modules/cctv/shared/rules";

/** The CCTV log end to end on an isolated database: recording at a site you cover, the checks on
 *  an entry, who reads whose entries, notes added later, and the audit trail that never repeats
 *  what was seen. Invented people and events only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/viewings/server/actions");
let data: typeof import("../features/viewings/server/data");
let home: typeof import("../features/viewings/server/contributions");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "nora", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["cctv"], primaryScreens: ["cctv"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["cctv"], scopeKind: "site", scopeId: siteId });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["nora", "duty", "ops"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [bishopstown] } });
  await db.user.create({ data: { id: "owner", name: "owner", email: "owner@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: [] } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Error(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = serverModule("src/modules/cctv/features/viewings/server/actions.ts", d);
  data = serverModule("src/modules/cctv/features/viewings/server/data.ts", d);
  home = serverModule("src/modules/cctv/features/viewings/server/contributions.ts", d);
});
after(async () => { await fixture?.close(); });

const entry = (siteId: string, change: Partial<ViewingInput> = {}): ViewingInput => ({
  siteId, viewedOn: today(), viewedAt: "10:30", checkedBy: "Duty manager", othersPresent: "", reason: "theft",
  background: "A member reported a bag missing from a locker.", purpose: "Whether anyone opened locker 14",
  cameras: "Camera 3, changing village corridor", footageOn: today(), footageFrom: "08:00", footageTo: "09:00",
  findings: "Nobody went near locker 14 in that hour.", copies: "", incident: "", ...change,
});

test("an entry says when, why, what was looked for and what was seen, with sane times", () => {
  const ok = viewingSchema.parse(entry("s"));
  assert.equal(viewingProblem(ok, today()), null);
  assert.match(viewingProblem({ ...ok, footageTo: "07:00" }, today())!, /end time/);
  assert.match(viewingProblem({ ...ok, viewedOn: "2999-01-01" }, today())!, /future/);
  assert.match(viewingProblem({ ...ok, footageOn: "2999-01-01", viewedOn: "2998-01-01" }, "2999-12-31")!, /after the day/);
  assert.ok(!viewingSchema.safeParse({ ...entry("s"), findings: "" }).success);
  assert.ok(!viewingSchema.safeParse({ ...entry("s"), reason: "curiosity" }).success);
  assert.equal(parseIncidentNumber("INC-00042"), 42);
  assert.equal(parseIncidentNumber("42"), 42);
  assert.equal(parseIncidentNumber(""), null);
  assert.equal(parseIncidentNumber("yesterday"), undefined);
});

let theirs = "";
test("Record saves at a site it covers, and only there", async () => {
  as("duty", [], [at(bishopstown, ["cctv.record"])]);
  const refused = await actions.recordViewing(entry(churchfield));
  assert.equal(refused.ok, false);
  const saved = await actions.recordViewing(entry(bishopstown, { incident: "INC-00007", othersPresent: "Garda Ryan" }));
  assert.ok(saved.ok && saved.id);
  theirs = saved.id!;
  const row = await fixture.prisma.cctvViewing.findUniqueOrThrow({ where: { id: theirs } });
  assert.equal(row.incidentNumber, 7);
  assert.equal(row.recordedByName, "duty");
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "CctvViewing", entityId: theirs } });
  assert.equal(log.module, "CCTV log");
  assert.ok(!log.summary.includes("locker"), "the activity log never repeats what was seen");
});

test("Record reads its own entries; Review reads everyone's at its sites; others get nothing", async () => {
  as("nora", [], [at(bishopstown, ["cctv.record"])]);
  assert.equal((await data.cctvViewings()).rows.length, 0);
  await assert.rejects(data.cctvViewing(theirs), NotFound);
  as("ops", [], [at(churchfield, ["cctv.review"])]);
  await assert.rejects(data.cctvViewing(theirs), NotFound);
  as("ops", [], [at(bishopstown, ["cctv.review"])]);
  const list = await data.cctvViewings();
  assert.deepEqual(list.rows.map((r) => r.id), [theirs]);
  assert.equal(list.rows[0].mine, false);
  assert.equal((await data.cctvViewing(theirs)).canNote, true);
  as("owner", ["cctv.review"]);
  assert.deepEqual((await data.cctvViewings()).rows.map((r) => r.id), [theirs], "Review at every site reads every entry");
});

test("an entry is only added to: notes by its recorder or Review at its site", async () => {
  as("nora", [], [at(bishopstown, ["cctv.record"])]);
  assert.equal((await actions.addViewingNote(theirs, "Not mine to add to")).ok, false);
  as("duty", [], [at(bishopstown, ["cctv.record"])]);
  assert.ok((await actions.addViewingNote(theirs, "The Gardaí collected the USB key.")).ok);
  as("ops", [], [at(bishopstown, ["cctv.review"])]);
  assert.ok((await actions.addViewingNote(theirs, "Reviewed, nothing more to do.")).ok);
  const notes = await fixture.prisma.cctvViewingNote.findMany({ where: { viewingId: theirs }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(notes.map((n) => n.byName), ["duty", "ops"]);
  assert.equal(typeof (actions as Record<string, unknown>).deleteViewing, "undefined");
  assert.equal(typeof (actions as Record<string, unknown>).updateViewing, "undefined");
});

test("Home offers recording a viewing to whoever may record one, anywhere, and nothing to anyone else", async () => {
  const viewer = (anywhere: string[], isSuperadmin = false) => ({ id: "v", name: "v", permissions: anywhere, anywhere, isSuperadmin });
  assert.deepEqual(await home.cctvHomeItems(viewer([])), []);
  assert.equal((await home.cctvHomeItems(viewer(["cctv.review"]))).length, 1, "Review includes Record");
  const [item] = await home.cctvHomeItems(viewer(["cctv.record"]));
  assert.deepEqual(item, { kind: "action", label: "Record a CCTV viewing", href: "/cctv/new", icon: "filePlus" });
  assert.equal((await home.cctvHomeItems(viewer([], true))).length, 1, "a superadmin holds everything");
});
