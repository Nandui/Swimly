import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Asking staff to cover a gap (D30), end to end on an isolated database: asking needs the
 *  department's Google Chat space; people answer; whoever plans the department chooses a yes and
 *  Plan puts them on (a new shift, or theirs grown); stopping closes it. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let cover: typeof import("../features/day/server/cover-actions");
let offers: typeof import("../shared/cover-offers");
let day: typeof import("../features/day/server/data");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "sup", permissions: [] as string[], grants: [] as GrantRow[] };
let site = "";
class Denied extends Error {}
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["plan"], primaryScreens: ["plan"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[]) => Object.assign(state, { id, permissions: [],
  grants: [{ roleName: "Site", permissions, screens: ["plan"], scopeKind: "site", scopeId: site }] });
const h = (n: number) => n * 60;
const DAY = addDaysIso(today(), 2);
const KEY = "s:swim:guard";
const ask = (over: Record<string, unknown> = {}) => cover.askForCover({ siteId: site, date: DAY, needKey: KEY, start: h(9), end: h(12), ...over });
const errorOf = (r: { ok: boolean; error?: string }) => (r.ok ? "" : r.error ?? "");

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  site = (await db.club.findFirst({ where: { orgId: ORG }, orderBy: { name: "asc" } }))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["sup", "viewer", "ann", "bea", "cal"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [site] } });
  await db.department.create({ data: { id: "d-pool", orgId: ORG, name: "Pool" } });
  await db.userDepartment.create({ data: { userId: "sup", departmentId: "d-pool" } });
  await db.planDuty.create({ data: { id: "guard", orgId: ORG, name: "Lifeguard", departmentId: "d-pool" } });
  await db.planSession.create({ data: { id: "swim", orgId: ORG, siteId: site, title: "Public swim", startMinutes: h(9), endMinutes: h(13), weekdays: [0, 1, 2, 3, 4, 5, 6],
    firstDay: today(), lastDay: addDaysIso(today(), 30), createdById: "sup", createdByName: "sup", needs: { create: { dutyId: "guard", count: 2 } } } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/auth": { auth: async () => session() },
    // Other apps are faked: no classes that day, and nothing of theirs to plan.
    "@/modules/contributions": { commitmentsFor: async () => [], planCommitment: async () => ({ ok: false, error: "That can no longer be planned from here." }) },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => site, currentClubIdIfAny: async () => site },
    "@/lib/remembered-site": { rememberedSite: async () => undefined },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  cover = serverModule("src/modules/plan/features/day/server/cover-actions.ts", d);
  offers = serverModule("src/modules/plan/shared/cover-offers.ts", d);
  day = serverModule("src/modules/plan/features/day/server/data.ts", d);
});
after(async () => { await fixture?.close(); });

test("nobody can be asked until the department has a Google Chat space at the site", async () => {
  as("sup", ["plan.plan"]);
  assert.match(errorOf(await ask()), /no Google Chat space linked/);
  await fixture.prisma.planChatSpace.create({ data: { orgId: ORG, siteId: site, departmentId: "d-pool", space: "spaces/EXAMPLE", name: "Pool team", linkedById: "sup", linkedByName: "sup" } });
});

test("whoever plans the department asks, once for a stretch, inside the session, for a day to come", async () => {
  as("viewer", ["plan.view"]);
  assert.match(errorOf(await ask()), /can't plan that department/);
  as("sup", ["plan.plan"]);
  assert.match(errorOf(await ask({ end: h(14) })), /runs 09:00 to 13:00/);
  assert.match(errorOf(await ask({ date: addDaysIso(today(), -1) })), /has passed/);
  assert.match(errorOf(await ask({ needKey: "s:gone:guard" })), /isn't on that day/);
  assert.deepEqual(await ask({ note: "Report to the duty manager" }), { ok: true });
  assert.match(errorOf(await ask({ start: h(11), end: h(13) })), /already being asked/);
  const row = await fixture.prisma.planCoverRequest.findFirstOrThrow();
  assert.deepEqual([row.title, row.dutyId, row.sessionId, row.departmentId, row.askedByName], ["Public swim", "guard", "swim", "d-pool", "sup"]);
});

test("people answer yes or no; the latest answer is kept, and the same answer twice writes once", async () => {
  const { id } = await fixture.prisma.planCoverRequest.findFirstOrThrow();
  assert.deepEqual(await offers.recordCoverAnswer({ requestId: id, userId: "ann", answer: "yes", via: "chat" }), { ok: true });
  assert.deepEqual(await offers.recordCoverAnswer({ requestId: id, userId: "ann", answer: "yes", via: "chat" }), { ok: true });
  assert.deepEqual(await offers.recordCoverAnswer({ requestId: id, userId: "bea", answer: "yes", via: "chat" }), { ok: true });
  assert.deepEqual(await offers.recordCoverAnswer({ requestId: id, userId: "bea", answer: "no", via: "chat" }), { ok: true });
  assert.match(errorOf(await offers.recordCoverAnswer({ requestId: id, userId: "nobody", answer: "yes", via: "chat" })), /couldn't find your Turnfin account/);
  const rows = await fixture.prisma.planCoverOffer.findMany({ orderBy: { userId: "asc" } });
  assert.deepEqual(rows.map((o) => `${o.userId} ${o.answer}`), ["ann yes", "bea no"]);
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "PlanCoverOffer" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audit.map((a) => `${a.actorId} ${a.action}`), ["ann create", "bea create", "bea update"], "each answer is the person's own audit row");
  assert.equal(audit[0].module, "Plan (test)");
});

test("the Day shows the request with its answers, by name, and who may choose", async () => {
  as("sup", ["plan.plan"]);
  const data = await day.planDay({ site, date: DAY });
  assert.ok(data.site);
  assert.deepEqual(data.askable, ["d-pool"]);
  const [request] = data.cover;
  assert.deepEqual([request.needKey, request.department, request.canChoose, request.note], [KEY, "Pool", true, "Report to the duty manager"]);
  assert.deepEqual(request.answers, [
    { userId: "ann", name: "ann", answer: "yes", qualified: true, off: false, shift: null },
    { userId: "bea", name: "bea", answer: "no", qualified: true, off: false, shift: null },
  ]);
  as("viewer", ["plan.view"]);
  const seen = await day.planDay({ site, date: DAY });
  assert.ok(seen.site);
  assert.deepEqual([seen.cover[0].canChoose, seen.askable], [false, []]);
});

test("choosing a yes gives them a shift for the stretch and the duty, and closes the request", async () => {
  const { id } = await fixture.prisma.planCoverRequest.findFirstOrThrow();
  as("viewer", ["plan.view"]);
  assert.match(errorOf(await cover.chooseCover(id, "ann")), /can't plan that department/);
  as("sup", ["plan.plan"]);
  assert.match(errorOf(await cover.chooseCover(id, "bea")), /haven't offered/);
  assert.deepEqual(await cover.chooseCover(id, "ann"), { ok: true });
  const shift = await fixture.prisma.planShift.findFirstOrThrow({ where: { userId: "ann" }, include: { blocks: true } });
  assert.deepEqual([shift.date, shift.departmentId, shift.startMinutes, shift.endMinutes], [DAY, "d-pool", h(9), h(12)]);
  assert.deepEqual(shift.blocks.map((b) => [b.dutyId, b.sessionId, b.startMinutes, b.endMinutes]), [["guard", "swim", h(9), h(12)]]);
  const request = await fixture.prisma.planCoverRequest.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([request.outcome, request.chosenUserId, request.closedByName], ["filled", "ann", "sup"]);
  assert.match(errorOf(await cover.chooseCover(id, "ann")), /already chosen/);
  assert.match(errorOf(await offers.recordCoverAnswer({ requestId: id, userId: "cal", answer: "yes", via: "chat" })), /already covered/);
  const audit = await fixture.prisma.auditLog.findMany({ where: { actorId: "sup", entity: { in: ["PlanShift", "PlanBlock", "PlanCoverRequest"] } }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audit.map((a) => `${a.entity} ${a.action}`).sort(), ["PlanBlock create", "PlanCoverRequest create", "PlanCoverRequest update", "PlanShift create"]);
});

test("someone already working that day has their shift grown to take the stretch in", async () => {
  const db = fixture.prisma;
  await db.planShift.create({ data: { orgId: ORG, siteId: site, departmentId: "d-pool", userId: "cal", date: DAY, startMinutes: h(10), endMinutes: h(14), createdById: "sup", createdByName: "sup" } });
  as("sup", ["plan.plan"]);
  assert.deepEqual(await ask(), { ok: true }, "the second place is still short, so it can be asked again");
  const { id } = await db.planCoverRequest.findFirstOrThrow({ where: { closedAt: null } });
  await offers.recordCoverAnswer({ requestId: id, userId: "cal", answer: "yes", via: "chat" });
  assert.deepEqual(await cover.chooseCover(id, "cal"), { ok: true });
  const shifts = await db.planShift.findMany({ where: { userId: "cal" }, include: { blocks: true } });
  assert.equal(shifts.length, 1);
  assert.deepEqual([shifts[0].startMinutes, shifts[0].endMinutes, shifts[0].blocks.length], [h(9), h(14), 1]);
});

test("stopping closes it: nobody is put on, and nobody can answer or be chosen after", async () => {
  const db = fixture.prisma;
  as("sup", ["plan.plan"]);
  assert.deepEqual(await ask({ date: addDaysIso(DAY, 1) }), { ok: true });
  const { id } = await db.planCoverRequest.findFirstOrThrow({ where: { closedAt: null } });
  await offers.recordCoverAnswer({ requestId: id, userId: "bea", answer: "yes", via: "chat" });
  as("viewer", ["plan.view"]);
  assert.match(errorOf(await cover.stopAsking(id)), /can't plan that department/);
  as("sup", ["plan.plan"]);
  assert.deepEqual(await cover.stopAsking(id), { ok: true });
  assert.match(errorOf(await cover.stopAsking(id)), /already stopped/);
  assert.match(errorOf(await cover.chooseCover(id, "bea")), /already stopped/);
  assert.match(errorOf(await offers.recordCoverAnswer({ requestId: id, userId: "ann", answer: "yes", via: "chat" })), /Nobody is being asked/);
  assert.equal(await db.planShift.count({ where: { userId: "bea" } }), 0);
});
