import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "@/lib/staff/permissions";
import { visibleScreens } from "@/lib/staff/screens";
import { today } from "@/lib/format";
import type { FollowUpInput } from "@/lib/enrolment/follow-up";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./follow-up");
const state = { signedIn: true, permission: true, screens: ["awaiting-enrolment"], actorId: "follow-up-alex", clubId: "club_bishopstown" };
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: Error,
      requireSession: async () => { if (!state.signedIn) throw Error("Sign in required"); return { user: { id: state.actorId, name: state.actorId === "follow-up-alex" ? "Alex Example" : "Riley Example", permissions: state.permission ? ["enrolment.manage"] : [], screens: state.screens } }; },
      can: (actor: { user: { permissions: string[] } }, permission: never) => expandPermissions(actor.user.permissions).has(permission),
      canSee: (actor: { user: { permissions: string[]; screens: string[] } }, screen: never) => visibleScreens(actor.user.screens, expandPermissions(actor.user.permissions)).has(screen),
    },
    "@/lib/clubs/current": { currentClubId: async () => state.clubId, currentClubIdIfAny: async () => state.clubId },
    "next/cache": { revalidatePath() {} },
  };
}
before(async () => {
  fixture = await isolatedPrisma();
  for (const id of ["follow-up-alex", "follow-up-riley"]) await fixture.prisma.user.create({ data: { id, name: "Example staff", email: `${id}@example.test` } });
  actions = serverModule("src/lib/enrolment/actions/follow-up.ts", doubles());
});
after(async () => { await fixture?.close(); });
async function swimmer(id: string) {
  await fixture.prisma.student.create({ data: { id, clubId: "club_bishopstown", firstName: "Avery", lastName: "Example", medicalNotes: "Must not be included", contactEmail: "family@example.test" } });
}
const input = (studentId: string, extra: Partial<FollowUpInput> = {}): FollowUpInput => ({ studentId, operationId: randomUUID(), expectedLatest: null, channel: "PHONE", outcome: "PARENT_NOT_READY", note: "Parent asked us to call next month.", occurredOn: "2026-09-01", nextContactOn: "2026-10-01", ...extra });

test("records staff work, site and outcome with an atomic audit and no enrolment changes", async () => {
  await swimmer("contact-history");
  const result = await actions.addFollowUp(input("contact-history"));
  assert.deepEqual(result, { ok: true });
  const history = await actions.getFollowUpHistory("contact-history");
  assert.equal(history.summary.count, 1); assert.equal(history.entries[0].actorName, "Alex Example");
  assert.equal(history.entries[0].outcome, "PARENT_NOT_READY"); assert.equal(history.entries[0].nextContactOn, "2026-10-01");
  assert.equal(history.entries[0].occurredOn, "2026-09-01");
  assert.equal(JSON.stringify(history).includes("Must not be included"), false);
  const audit = await fixture.prisma.auditLog.findFirst({ where: { entityId: "contact-history" } });
  assert.equal(audit?.action, "enrolment-follow-up"); assert.equal(audit?.clubId, null);
  assert.equal(await fixture.prisma.enrolment.count(), 0);
});

test("history and current outcome are shared across sites and survive leaving the waiting queue", async () => {
  state.clubId = "club_churchfield"; state.actorId = "follow-up-riley";
  try {
    const initial = await actions.getFollowUpHistory("contact-history");
    assert.equal(initial.summary.count, 1);
    await actions.addFollowUp(input("contact-history", { expectedLatest: initial.summary.latest!.sequence, outcome: "NO_SUITABLE_CLASS", channel: "INTERNAL", nextContactOn: "", note: "Checked both sites; no suitable time available." }));
    await fixture.prisma.student.update({ where: { id: "contact-history" }, data: { status: "INACTIVE" } });
    const history = await actions.getFollowUpHistory("contact-history");
    assert.equal(history.summary.count, 2); assert.equal(history.entries[0].actorName, "Riley Example");
    assert.equal(history.summary.latest?.nextContactOn, null);
    assert.equal(history.entries[0].clubName, "LeisureWorld Churchfield");
    assert.equal(history.entries[1].note, "Parent asked us to call next month.");
  } finally { state.clubId = "club_bishopstown"; state.actorId = "follow-up-alex"; }
});

test("requires a desk screen and enrolment.manage; read-only staff can inspect but cannot write", async () => {
  const count = await fixture.prisma.studentFollowUp.count();
  state.permission = false;
  try { assert.equal((await actions.getFollowUpHistory("contact-history")).summary.count, 2); await assert.rejects(actions.addFollowUp(input("contact-history")), /permission/); }
  finally { state.permission = true; }
  state.screens = ["instructor"];
  try { await assert.rejects(actions.getFollowUpHistory("contact-history"), /access/); await assert.rejects(actions.addFollowUp(input("contact-history")), /access/); }
  finally { state.screens = ["students"]; }
  assert.equal((await actions.getFollowUpHistory("contact-history")).summary.count, 2);
  state.screens = ["awaiting-enrolment"]; state.signedIn = false;
  try { await assert.rejects(actions.getFollowUpHistory("contact-history"), /Sign in/); }
  finally { state.signedIn = true; }
  assert.equal(await fixture.prisma.studentFollowUp.count(), count);
});

test("validates notes, outcomes, calendar dates, missing swimmers and future contact dates", async () => {
  await swimmer("validation-history");
  for (const extra of [{ note: "  " }, { note: "a".repeat(3001) }, { channel: "UNKNOWN" }, { outcome: "UNKNOWN" }, { occurredOn: "2026-02-31" }, { occurredOn: "2099-01-01" }, { nextContactOn: "2026-08-01" }, { nextContactOn: "2026-02-31" }, { expectedLatest: -1 }, { operationId: "bad" }]) {
    assert.equal((await actions.addFollowUp(input("validation-history", extra))).ok, false);
  }
  assert.equal((await actions.addFollowUp(input("does-not-exist"))).ok, false);
  assert.equal(await fixture.prisma.studentFollowUp.count({ where: { studentId: "validation-history" } }), 0);
});

test("retries create one entry and one audit, while different payloads cannot reuse an operation", async () => {
  await swimmer("retry-history");
  const payload = input("retry-history");
  const results = await Promise.all([actions.addFollowUp(payload), actions.addFollowUp(payload)]);
  assert.ok(results.every(result => result.ok));
  assert.equal(await fixture.prisma.studentFollowUp.count({ where: { studentId: payload.studentId } }), 1);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: payload.studentId } }), 1);
  assert.equal((await actions.addFollowUp({ ...payload, note: "Different note" })).ok, false);
  state.actorId = "follow-up-riley";
  try { assert.equal((await actions.addFollowUp(payload)).ok, false); }
  finally { state.actorId = "follow-up-alex"; }
});

test("conflicting updates do not overwrite a colleague's current outcome", async () => {
  await swimmer("conflict-history");
  const results = await Promise.all([actions.addFollowUp(input("conflict-history")), actions.addFollowUp(input("conflict-history", { outcome: "NO_REPLY" }))]);
  assert.equal(results.filter(result => result.ok).length, 1);
  const current = await actions.getFollowUpHistory("conflict-history");
  assert.equal((await actions.addFollowUp(input("conflict-history", { expectedLatest: current.summary.latest!.sequence, note: "Reviewed colleague’s update and agreed the next step." }))).ok, true);
  assert.equal((await actions.getFollowUpHistory("conflict-history")).summary.count, 2);
});

test("audit failure rolls the history entry back", async () => {
  await swimmer("rollback-history");
  const broken = serverModule<typeof import("./follow-up")>("src/lib/enrolment/actions/follow-up.ts", { ...doubles(), "@/lib/audit": { logAudit: async () => { throw Error("Audit unavailable"); } } });
  await assert.rejects(broken.addFollowUp(input("rollback-history")), /Audit unavailable/);
  assert.equal(await fixture.prisma.studentFollowUp.count({ where: { studentId: "rollback-history" } }), 0);
});

test("bounded chronological history pagination has no duplicates and keeps the latest summary", async () => {
  await swimmer("paged-history");
  for (let index = 0; index < 25; index++) await fixture.prisma.studentFollowUp.create({ data: { studentId: "paged-history", operationId: randomUUID(), actorId: state.actorId, actorName: "Alex Example", clubId: state.clubId, clubName: "Example site", channel: "PHONE", outcome: "CONTACTED", note: `Example update ${index}`, occurredOn: new Date(`${today()}T00:00:00Z`) } });
  const first = await actions.getFollowUpHistory("paged-history");
  const second = await actions.getFollowUpHistory("paged-history", first.nextBefore!);
  assert.equal(first.entries.length, 20); assert.equal(second.entries.length, 5); assert.equal(second.nextBefore, null);
  assert.equal(new Set([...first.entries, ...second.entries].map(entry => entry.id)).size, 25);
  assert.equal(first.summary.latest?.id, second.summary.latest?.id);
  assert.equal(first.summary.count, 25);
  await assert.rejects(actions.getFollowUpHistory("paged-history", -1), /reload/);
});
