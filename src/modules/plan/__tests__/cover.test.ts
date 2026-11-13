import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Asking staff to cover a gap (D30), end to end on an isolated database with Google Chat faked:
 *  a space is linked in Setup; asking posts a card there; people answer from Chat, matched by
 *  email; whoever plans the department chooses a yes and Plan puts them on (a new shift, or theirs
 *  grown); stopping closes it; the card follows each step. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let cover: typeof import("../features/day/server/cover-actions");
let offers: typeof import("../shared/cover-offers");
let day: typeof import("../features/day/server/data");
let setup: typeof import("../features/setup/server/chat-actions");
let events: typeof import("../features/chat/server/events");
/** Google Chat, faked: what was posted and changed, and switches to make it fail or go unsigned. */
type Sent = { text?: string; cardsV2?: { card: { header: { title: string }; sections: { widgets: Record<string, unknown>[] }[] } }[] };
const chat = { posted: [] as { space: string; message: Sent }[], updated: [] as { name: string; message: Sent }[], down: false, signed: true, ready: true };
const widgets = (m: Sent) => JSON.stringify(m.cardsV2?.[0].card.sections[0].widgets ?? []);
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
    "@/modules/plan/shared/chat": {
      chatConfig: () => (chat.ready ? { clientEmail: "app@example.invalid", privateKey: "key", projectNumber: "1234567890" } : null),
      chatSpaces: async () => { if (chat.down) throw new Error("down"); return [{ space: "spaces/EXAMPLE", name: "Pool team" }, { space: "spaces/OTHER", name: "Reception team" }]; },
      postChatMessage: async (_c: unknown, space: string, message: Sent) => { if (chat.down) throw new Error("down"); chat.posted.push({ space, message }); return `${space}/messages/m${chat.posted.length}`; },
      updateChatMessage: async (_c: unknown, name: string, message: Sent) => { if (chat.down) throw new Error("down"); chat.updated.push({ name, message }); },
      fromGoogleChat: async () => chat.signed,
    },
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
  setup = serverModule("src/modules/plan/features/setup/server/chat-actions.ts", d);
  events = serverModule("src/modules/plan/features/chat/server/events.ts", d);
});
after(async () => { await fixture?.close(); });

test("nobody can be asked until a manager links the department's Google Chat space in Setup", async () => {
  as("sup", ["plan.plan"]);
  assert.match(errorOf(await ask()), /no Google Chat space linked/);
  assert.match(errorOf(await setup.linkChatSpace({ siteId: site, departmentId: "d-pool", space: "spaces/EXAMPLE" })), /manages the plan/);
  assert.match(errorOf(await setup.chatSpacesToLink(site)), /manages the plan/);
  as("sup", ["plan.view", "plan.plan", "plan.manage"]);
  const found = await setup.chatSpacesToLink(site);
  assert.deepEqual(found.ok && found.spaces.map((s) => s.name), ["Pool team", "Reception team"]);
  assert.match(errorOf(await setup.linkChatSpace({ siteId: site, departmentId: "d-pool", space: "spaces/NOT-MINE" })), /isn't in that space/);
  assert.match(errorOf(await setup.linkChatSpace({ siteId: site, departmentId: "d-gone", space: "spaces/EXAMPLE" })), /isn't at this site/);
  chat.ready = false;
  assert.match(errorOf(await setup.linkChatSpace({ siteId: site, departmentId: "d-pool", space: "spaces/EXAMPLE" })), /isn't set up/);
  chat.ready = true;
  assert.deepEqual(await setup.linkChatSpace({ siteId: site, departmentId: "d-pool", space: "spaces/EXAMPLE" }), { ok: true });
  const row = await fixture.prisma.planChatSpace.findFirstOrThrow();
  assert.deepEqual([row.space, row.name, row.linkedByName], ["spaces/EXAMPLE", "Pool team", "sup"], "the space's name comes from Google");
});

test("a request Google Chat won't take is stopped again: nobody was asked", async () => {
  as("sup", ["plan.plan"]);
  chat.down = true;
  assert.match(errorOf(await ask()), /didn't take the request/);
  chat.down = false;
  const rows = await fixture.prisma.planCoverRequest.findMany();
  assert.deepEqual(rows.map((r) => [r.outcome, r.chatMessage]), [["stopped", null]]);
  await fixture.prisma.planCoverRequest.deleteMany();
  await fixture.prisma.auditLog.deleteMany({ where: { entity: "PlanCoverRequest" } });
  chat.ready = false;
  assert.match(errorOf(await ask()), /isn't set up/);
  chat.ready = true;
  assert.equal(await fixture.prisma.planCoverRequest.count(), 0);
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
  // Its card went to the department's space, with the two buttons, and the request remembers it.
  assert.equal(chat.posted.length, 1);
  const [{ space, message }] = chat.posted;
  assert.equal(space, "spaces/EXAMPLE");
  assert.equal(row.chatMessage, "spaces/EXAMPLE/messages/m1");
  assert.match(message.text ?? "", /^Cover needed: Lifeguard for Public swim, /);
  assert.match(widgets(message), /I can cover.*Can't/);
  assert.match(widgets(message), /Report to the duty manager/);
  assert.match(widgets(message), /Nobody has answered yet/);
});

/** A click on a card, as Google Chat sends it. */
const click = (requestId: string, answer: string, email: string, message = "spaces/EXAMPLE/messages/m1") => events.handleChatEvent(new Request("https://turnfin.example/api/plan/chat", {
  method: "POST", headers: { authorization: "Bearer signed.by.google" },
  body: JSON.stringify({ type: "CARD_CLICKED", user: { name: "users/1", email, type: "HUMAN" }, message: { name: message },
    common: { invokedFunction: "plan.cover.answer", parameters: { request: requestId, answer } } }),
}));

test("a click in Google Chat is that person's answer, matched by email; the card then names who can cover", async () => {
  const { id } = await fixture.prisma.planCoverRequest.findFirstOrThrow();
  chat.signed = false;
  assert.equal((await click(id, "yes", "cal@example.invalid")).status, 401, "anything Google did not sign is refused");
  chat.signed = true;
  const said = await (await click(id, "yes", "CAL@example.invalid")).json();
  assert.equal(said.actionResponse.type, "UPDATE_MESSAGE");
  assert.match(widgets(said), /Can cover: cal/);
  const stranger = await (await click(id, "yes", "who@example.invalid")).json();
  assert.equal(stranger.privateMessageViewer.name, "users/1", "only they see it");
  assert.match(stranger.text, /couldn't find your Turnfin account/);
  assert.deepEqual(await (await click(id, "yes", "bea@example.invalid", "spaces/OTHER/messages/x")).json(), {}, "a button on another card answers nothing");
  assert.deepEqual(await (await click(id, "maybe", "bea@example.invalid")).json(), {});
  const took = await (await click(id, "no", "cal@example.invalid")).json();
  assert.match(widgets(took), /Nobody has answered yet/, "a no is not named on the card");
  const rows = await fixture.prisma.planCoverOffer.findMany();
  assert.deepEqual(rows.map((o) => `${o.userId} ${o.answer} ${o.via}`), ["cal no chat"]);
  await fixture.prisma.planCoverOffer.deleteMany();
  await fixture.prisma.auditLog.deleteMany({ where: { entity: "PlanCoverOffer" } });
  const added = await (await events.handleChatEvent(new Request("https://turnfin.example/api/plan/chat", { method: "POST", headers: { authorization: "Bearer signed.by.google" }, body: JSON.stringify({ type: "ADDED_TO_SPACE" }) }))).json();
  assert.match(added.text, /link this space to a department/);
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
  // The card lost its buttons and says who covers it; a late click gets a private word.
  const last = chat.updated[chat.updated.length - 1];
  assert.equal(last.name, "spaces/EXAMPLE/messages/m1");
  assert.match(widgets(last.message), /Covered by ann/);
  assert.doesNotMatch(widgets(last.message), /I can cover/);
  const late = await (await click(id, "yes", "cal@example.invalid")).json();
  assert.match(late.text, /already covered/);
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
  as("sup", ["plan.view", "plan.plan", "plan.manage"]);
  assert.match(errorOf(await setup.unlinkChatSpace({ siteId: site, departmentId: "d-pool" })), /still being asked to cover one gap/);
  as("sup", ["plan.plan"]);
  assert.deepEqual(await cover.stopAsking(id), { ok: true });
  assert.match(widgets(chat.updated[chat.updated.length - 1].message), /No longer needed/);
  assert.match(errorOf(await cover.stopAsking(id)), /already stopped/);
  assert.match(errorOf(await cover.chooseCover(id, "bea")), /already stopped/);
  assert.match(errorOf(await offers.recordCoverAnswer({ requestId: id, userId: "ann", answer: "yes", via: "chat" })), /Nobody is being asked/);
  assert.equal(await db.planShift.count({ where: { userId: "bea" } }), 0);
  as("sup", ["plan.view", "plan.plan", "plan.manage"]);
  assert.deepEqual(await setup.unlinkChatSpace({ siteId: site, departmentId: "d-pool" }), { ok: true });
  assert.equal(await db.planChatSpace.count(), 0);
  as("sup", ["plan.plan"]);
  assert.match(errorOf(await ask({ date: addDaysIso(DAY, 2) })), /no Google Chat space linked/);
});
