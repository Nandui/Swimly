import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

type Actions = typeof import("@/modules/activities/features/enrolment/server/actions/manual-placement");
type Read = typeof import("@/modules/activities/features/enrolment/server/data/awaiting-enrolment");

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: Actions;
let read: Read["getAwaitingEnrolment"];
const state = { clubId: "club_bishopstown", allowed: true };
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.user.create({ data: { id: "desk-user", name: "Synthetic desk", email: "desk-user@example.invalid" } });
  await db.programme.create({ data: { id: "hand-programme", clubId: "club_bishopstown", name: "Synthetic swimming" } });
  await db.level.create({ data: { id: "hand-level", programmeId: "hand-programme", name: "Turtles" } });
  await db.level.create({ data: { id: "hand-higher", programmeId: "hand-programme", name: "Dolphins", sortOrder: 2 } });
  await db.level.create({ data: { id: "hand-archived", programmeId: "hand-programme", name: "Retired", archivedAt: date("2026-01-01") } });
  await db.course.create({ data: { id: "hand-course", clubId: "club_bishopstown", levelId: "hand-level", dayOfWeek: "MONDAY", startMinutes: 900, durationMinutes: 30 } });
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      requireSession: async () => {},
      requirePermission: async (key: string) => {
        assert.equal(key, "enrolment.manage");
        if (!state.allowed) throw Error("Not allowed");
        return { user: { id: "desk-user", name: "Synthetic desk" } };
      },
    },
    "@/lib/clubs/current": { currentClubId: async () => state.clubId, currentClubIdIfAny: async () => state.clubId },
    "next/cache": { revalidatePath: () => {} },
    react: { cache: (fn: unknown) => fn },
  };
  actions = serverModule<Actions>("src/modules/activities/features/enrolment/server/actions/manual-placement.ts", doubles);
  read = serverModule<Read>("src/modules/activities/features/enrolment/server/data/awaiting-enrolment.ts", doubles).getAwaitingEnrolment;
});
after(async () => { await fixture?.close(); });

async function swimmer(id: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  await fixture.prisma.student.create({ data: { id, clubId: "club_bishopstown", firstName: id, lastName: "Example", memberNumber: `HAND-${id}`, status } });
}

test("a swimmer added by hand joins this site's list at that level, with who added them and why", async () => {
  await swimmer("hand-added");
  const result = await actions.addManualPlacement({ studentId: "hand-added", levelId: "hand-higher", reason: "Moved from another swim school" });
  assert.deepEqual(result, { ok: true });
  const list = await read({ q: "hand-added" });
  assert.equal(list.total, 1);
  const [row] = list.items;
  assert.equal(row.outcomeLevel?.name, "Dolphins");
  assert.equal(row.programme.id, "hand-programme");
  assert.equal(row.assessedOn, null);
  assert.equal(row.manual?.reason, "Moved from another swim school");
  assert.equal(row.manual?.addedByName, "Synthetic desk");
  const audit = await fixture.prisma.auditLog.findFirst({ where: { entity: "Student", entityId: "hand-added", action: "add-awaiting" } });
  assert.ok(audit?.summary.includes("by hand"));
  assert.equal(audit?.clubId, "club_bishopstown");
  state.clubId = "club_churchfield";
  try { assert.equal((await read({ q: "hand-added" })).total, 0, "only on the site that added them"); }
  finally { state.clubId = "club_bishopstown"; }
});

test("adding again replaces the earlier entry rather than listing the swimmer twice", async () => {
  await swimmer("hand-twice");
  await actions.addManualPlacement({ studentId: "hand-twice", levelId: "hand-level", reason: "First go" });
  await actions.addManualPlacement({ studentId: "hand-twice", levelId: "hand-higher", reason: "Level corrected" });
  const list = await read({ q: "hand-twice" });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].manual?.reason, "Level corrected");
  const rows = await fixture.prisma.manualPlacement.findMany({ where: { studentId: "hand-twice" }, orderBy: { createdAt: "asc" } });
  assert.equal(rows.length, 2, "never deleted");
  assert.equal(rows[0].removedReason, "Added again");
});

test("a class place in the programme takes them off the list, as it does after an assessment", async () => {
  await swimmer("hand-enrolled");
  await actions.addManualPlacement({ studentId: "hand-enrolled", levelId: "hand-level", reason: "Sibling of a current swimmer" });
  await fixture.prisma.enrolment.create({ data: { studentId: "hand-enrolled", courseId: "hand-course", programmeId: "hand-programme", levelId: "hand-level", status: "ACTIVE", startedOn: date("2030-01-01") } });
  assert.equal((await read({ q: "hand-enrolled" })).total, 0);
  const again = await actions.addManualPlacement({ studentId: "hand-enrolled", levelId: "hand-level", reason: "Try again" });
  assert.equal(again.ok, false);
});

test("taking them off keeps the entry, marks who and why, and is in their history", async () => {
  await swimmer("hand-removed");
  await actions.addManualPlacement({ studentId: "hand-removed", levelId: "hand-level", reason: "Added in error?" });
  const [row] = (await read({ q: "hand-removed" })).items;
  assert.deepEqual(await actions.removeManualPlacement({ id: row.manual!.id, reason: "Family no longer looking" }), { ok: true });
  assert.equal((await read({ q: "hand-removed" })).total, 0);
  const stored = await fixture.prisma.manualPlacement.findUniqueOrThrow({ where: { id: row.manual!.id } });
  assert.ok(stored.removedAt);
  assert.equal(stored.removedByName, "Synthetic desk");
  assert.equal(stored.removedReason, "Family no longer looking");
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entityId: "hand-removed", action: "remove-awaiting" } }));
  state.clubId = "club_churchfield";
  try { assert.equal((await actions.removeManualPlacement({ id: row.manual!.id, reason: "" })).ok, false, "another site's entry is out of reach"); }
  finally { state.clubId = "club_bishopstown"; }
});

test("refuses inactive swimmers, archived levels, a missing reason and staff without enrolment access", async () => {
  await swimmer("hand-inactive", "INACTIVE");
  await swimmer("hand-checks");
  assert.equal((await actions.addManualPlacement({ studentId: "hand-inactive", levelId: "hand-level", reason: "x" })).ok, false);
  assert.equal((await actions.addManualPlacement({ studentId: "hand-checks", levelId: "hand-archived", reason: "x" })).ok, false);
  assert.equal((await actions.addManualPlacement({ studentId: "hand-checks", levelId: "hand-level", reason: "  " })).ok, false);
  state.allowed = false;
  try { await assert.rejects(actions.addManualPlacement({ studentId: "hand-checks", levelId: "hand-level", reason: "x" }), /Not allowed/); }
  finally { state.allowed = true; }
  assert.equal(await fixture.prisma.manualPlacement.count({ where: { studentId: { in: ["hand-inactive", "hand-checks"] } } }), 0);
});
