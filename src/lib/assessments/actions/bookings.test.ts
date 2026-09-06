import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Actions = typeof import("./bookings");

function fixture() {
  const session = { id: "session", clubId: "club", date: new Date("2000-01-01T00:00:00Z"), startMinutes: 900, capacity: 2, programmeId: "programme", cancelledAt: null as Date | null };
  const student = { id: "swimmer", clubId: "club", firstName: "Test", lastName: "Swimmer", status: "ACTIVE" };
  const booking = {
    id: "booking", studentId: "swimmer", sessionId: "session", status: "BOOKED",
    outcomeLevelId: null as string | null, outcomeNote: null as string | null,
    outcomeLevel: null as { name: string } | null, assessedByName: "Original Assessor", session, student,
  };
  const writes: object[] = [];
  const audits: object[] = [];
  let locked = false;
  let beforeTransaction: (() => void) | undefined;
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    student: { findUnique: async ({ where }: { where: { clubId: string } }) => where.clubId === student.clubId ? student : null },
    assessmentSession: { findUnique: async ({ where }: { where: { clubId: string } }) => {
      assert.ok(locked, "session status and capacity follow its lock");
      return where.clubId === session.clubId ? session : null;
    } },
    assessmentBooking: {
      findUnique: async ({ where }: { where: { id?: string; session?: { clubId: string }; student?: { clubId: string } } }) => {
        if (where.session && where.session.clubId !== session.clubId) return null;
        if (where.student && where.student.clubId !== student.clubId) return null;
        return booking;
      },
      count: async () => 0,
      update: async ({ data }: { data: object }) => { writes.push(data); Object.assign(booking, data); return booking; },
      create: async ({ data }: { data: object }) => { writes.push(data); return booking; },
    },
    level: { findFirst: async () => ({ id: "level", name: "Entry" }) },
    auditLog: { create: async ({ data }: { data: object }) => { audits.push(data); } },
  };
  const prisma = { ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
    beforeTransaction?.(); beforeTransaction = undefined;
    return run(tx);
  } };
  const actions = serverModule<Actions>("src/lib/assessments/actions/bookings.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Test Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club", currentClubIdIfAny: async () => "club" },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, session, student, booking, writes, audits,
    beforeTransaction: (run: () => void) => { beforeTransaction = run; },
  };
}

test("assessment booking refuses a swimmer from another club", async () => {
  const f = fixture(); f.student.clubId = "other";
  assert.equal((await f.actions.bookStudent({ sessionId: "session", studentId: "swimmer" })).ok, false);
  assert.equal(f.writes.length, 0);
});

test("a session cancelled before the lock cannot receive a new booking", async () => {
  const f = fixture(); f.booking.status = "CANCELLED";
  f.beforeTransaction(() => { f.session.cancelledAt = new Date(); });
  assert.equal((await f.actions.bookStudent({ sessionId: "session", studentId: "swimmer" })).ok, false);
  assert.equal(f.writes.length, 0);
});

test("a stale cancellation cannot overwrite a recorded assessment outcome", async () => {
  const f = fixture(); f.beforeTransaction(() => { f.booking.status = "ATTENDED"; });
  assert.equal((await f.actions.cancelBooking("booking")).ok, false);
  assert.equal(f.booking.status, "ATTENDED"); assert.equal(f.audits.length, 0);
});

test("re-submitting an unchanged placement keeps its original assessor", async () => {
  const f = fixture(); f.booking.status = "ATTENDED"; f.booking.outcomeLevelId = "level";
  assert.equal((await f.actions.recordOutcome({ bookingId: "booking", levelId: "level", note: "" })).ok, true);
  assert.equal(f.booking.assessedByName, "Original Assessor"); assert.equal(f.writes.length, 0); assert.equal(f.audits.length, 0);
});

test("future assessments cannot be marked as attended or a no-show", async () => {
  const f = fixture(); f.session.date = new Date("2999-01-01T00:00:00Z");
  assert.equal((await f.actions.markNoShow("booking")).ok, false);
  assert.equal((await f.actions.recordOutcome({ bookingId: "booking", levelId: "level", note: "" })).ok, false);
  assert.equal(f.writes.length, 0);
});

test("assessment audit identifies the changed booking and its club", async () => {
  const f = fixture();
  assert.equal((await f.actions.recordOutcome({ bookingId: "booking", levelId: "level", note: "Ready" })).ok, true);
  assert.equal(f.audits.length, 1);
  assert.equal((f.audits[0] as { entityId: string }).entityId, "booking");
  assert.equal((f.audits[0] as { clubId: string }).clubId, "club");
});
