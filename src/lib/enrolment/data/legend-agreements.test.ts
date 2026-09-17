import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { EnrolmentStatus, LegendAgreementStatus } from "@/generated/prisma/client";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let read: typeof import("./legend-agreements").getLegendAgreements;
let confirm: typeof import("../actions/legend-agreements").confirmLegendAgreement;
const state = { club: "club_bishopstown", authenticated: true, allowed: true, auditFails: false };
before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.programme.create({ data: { id: "agreement-programme", clubId: state.club, name: "Synthetic swimming" } });
  await db.level.create({ data: { id: "agreement-level", programmeId: "agreement-programme", name: "Turtles" } });
  for (const [id, clubId] of [["agreement-class", "club_bishopstown"], ["agreement-other-class", "club_churchfield"]]) {
    await db.course.create({ data: { id, clubId, levelId: "agreement-level", dayOfWeek: "MONDAY", startMinutes: 900, durationMinutes: 30 } });
  }
  const mocks = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      requireSession: async () => { if (!state.authenticated) throw Error("Sign in required"); },
      requirePermission: async (permission: string) => {
        assert.equal(permission, "enrolment.manage");
        if (!state.allowed) throw Error("Permission denied");
        return { user: { id: "synthetic-staff", name: "Alex Example" } };
      },
    },
    "@/lib/clubs/current": { currentClubId: async () => state.club },
    "@/lib/audit": { logAudit: async (input: object, tx: typeof db) => {
      if (state.auditFails) throw Error("Audit unavailable");
      // The isolated fixture has no staff account. Keep the real audit data,
      // omitting only its actor foreign key; recorded attribution is tested below.
      await tx.auditLog.create({ data: { ...input, actorId: null } as Parameters<typeof db.auditLog.create>[0]["data"] });
    } },
    "next/cache": { revalidatePath: () => {} },
    react: { cache: (fn: unknown) => fn },
  };
  read = serverModule<typeof import("./legend-agreements")>("src/lib/enrolment/data/legend-agreements.ts", mocks).getLegendAgreements;
  confirm = serverModule<typeof import("../actions/legend-agreements")>("src/lib/enrolment/actions/legend-agreements.ts", mocks).confirmLegendAgreement;
});
beforeEach(async () => {
  state.club = "club_bishopstown"; state.authenticated = true; state.allowed = true; state.auditFails = false;
  await fixture.prisma.auditLog.deleteMany();
  await fixture.prisma.enrolment.deleteMany();
  await fixture.prisma.student.deleteMany();
});
after(async () => { await fixture?.close(); });

async function place(id: string, options: { status?: EnrolmentStatus; agreement?: LegendAgreementStatus; otherSite?: boolean; studentId?: string; start?: string } = {}) {
  const db = fixture.prisma, studentId = options.studentId ?? id;
  if (!options.studentId) await db.student.create({ data: { id: studentId, clubId: "club_bishopstown", firstName: id, lastName: "Example", memberNumber: `TEST-${id}`, medicalNotes: "Never return this", contactEmail: "guardian@example.test" } });
  return db.enrolment.create({ data: { id, studentId, courseId: options.otherSite ? "agreement-other-class" : "agreement-class", levelId: "agreement-level", programmeId: "agreement-programme", startedOn: new Date(`${options.start ?? "2026-09-01"}T00:00:00Z`), status: options.status ?? "ACTIVE", ...(options.agreement ? { legendAgreementStatus: options.agreement } : {}) } });
}

test("existing active places default to needs-checking; pending is included and only active local places are listed", async () => {
  const legacy = await place("legacy"); assert.equal(legacy.legendAgreementStatus, "NEEDS_CHECK");
  await place("pending", { agreement: "PENDING" });
  await place("done", { agreement: "DONE" });
  await place("waiting", { status: "WAITLISTED" });
  await place("ended", { status: "WITHDRAWN" });
  await place("moved", { status: "TRANSFERRED" });
  await place("other", { otherSite: true });
  const result = await read();
  assert.deepEqual(new Set(result.items.map(row => row.id)), new Set(["legacy", "pending"]));
  assert.equal(result.doneCount, 1);
  assert.equal((await read({ view: "done" })).items[0].id, "done");
  assert.equal("medicalNotes" in result.items[0].student, false);
  assert.equal("contactEmail" in result.items[0].student, false);
  state.club = "club_churchfield";
  assert.deepEqual((await read()).items.map(row => row.id), ["other"]);
});

test("an agreement is per class place, not a shared flag on the swimmer", async () => {
  await place("first", { agreement: "DONE" });
  await place("second", { studentId: "first", otherSite: true });
  state.club = "club_churchfield";
  assert.equal((await read()).total, 1);
});

test("search and pagination are bounded and stable", async () => {
  for (let i = 0; i < 23; i++) await place(`swimmer${String(i).padStart(2, "0")}`);
  assert.equal((await read()).items.length, 20);
  const next = await read({ page: 2 }); assert.equal(next.items.length, 3); assert.equal(next.pages, 2);
  assert.equal((await read({ page: 999 })).page, 2);
  assert.equal((await read({ page: NaN })).page, 1);
  assert.equal((await read({ q: "swimmer22 Example" })).total, 1);
  assert.equal((await read({ q: "TEST-swimmer22" })).total, 1);
});

test("confirming records who and when, writes one audit and is safe to repeat", async () => {
  await place("confirm");
  assert.equal((await confirm("confirm")).ok, true);
  const row = await fixture.prisma.enrolment.findUniqueOrThrow({ where: { id: "confirm" } });
  assert.equal(row.legendAgreementStatus, "DONE");
  assert.equal(row.legendAgreementUpdatedByName, "Alex Example");
  assert.equal(row.legendAgreementUpdatedById, "synthetic-staff");
  assert(row.legendAgreementUpdatedAt instanceof Date);
  assert.equal((await read()).total, 0);
  assert.equal((await confirm("confirm")).ok, true);
  assert.equal(await fixture.prisma.auditLog.count(), 1);
});

test("confirmation rejects another site, ended places and missing permission", async () => {
  await place("other", { otherSite: true }); await place("ended", { status: "TRANSFERRED" });
  assert.equal((await confirm("other")).ok, false);
  assert.equal((await confirm("ended")).ok, false);
  assert.equal((await confirm("")).ok, false);
  state.allowed = false;
  await assert.rejects(confirm("other"), /Permission denied/);
  assert.equal(await fixture.prisma.auditLog.count(), 0);
});

test("a failed audit rolls back agreement completion", async () => {
  await place("rollback"); state.auditFails = true;
  await assert.rejects(confirm("rollback"), /Audit unavailable/);
  assert.equal((await fixture.prisma.enrolment.findUniqueOrThrow({ where: { id: "rollback" } })).legendAgreementStatus, "NEEDS_CHECK");
});

test("agreement reads require authentication before querying", async () => {
  state.authenticated = false;
  await assert.rejects(read(), /Sign in required/);
});
