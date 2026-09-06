import assert from "node:assert/strict";
import test from "node:test";
import { serverModule } from "@/test/server-module";

import { savedRegister } from "@/lib/attendance/revision";
import type { AttendanceStatus } from "@/generated/prisma/client";

function fixture() {
  const rows: { studentId: string; status: AttendanceStatus; note: string | null; markedById: string }[] = [
    { studentId: "one", status: "PRESENT", note: null as string | null, markedById: "original" },
    { studentId: "two", status: "ABSENT", note: null as string | null, markedById: "original" },
  ];
  let note = "Original class note";
  let failAudit = false;
  const audits: { summary: string }[] = [];
  const updated: string[] = [];
  let archived = false;
  let beforeTransaction: (() => void) | undefined;
  let queue = Promise.resolve();
  let locked = false;
  const readGuard = () => assert.equal(locked, true, "register reads follow the course lock");
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    course: {
      findUnique: async ({ where }: { where: { clubId: string } }) => {
        readGuard(); return where.clubId === "club" ? {
          name: "Test class", dayOfWeek: "MONDAY", startMinutes: 900, instructorId: "instructor", archivedAt: archived ? new Date() : null,
          level: { name: "Test level", programmeId: "programme" },
        } : null;
      }
    },
    classCover: { findUnique: async () => { readGuard(); return null; } },
    enrolment: { findMany: async () => { readGuard(); return [{ studentId: "one" }, { studentId: "two" }]; } },
    student: { findMany: async () => ["one", "two"].map(id => ({ id, firstName: "Test", lastName: id })) },
    attendanceRecord: {
      findMany: async () => { readGuard(); return structuredClone(rows); }, upsert: async ({ where, update, create }: { where: { courseId_date_studentId: { studentId: string } }; update: object; create: (typeof rows)[number] }) => {
        const id = where.courseId_date_studentId.studentId;
        updated.push(id);
        const existing = rows.find(row => row.studentId === id);
        if (existing) Object.assign(existing, update);
        else rows.push({ ...create, studentId: id });
      }
    },
    classNote: {
      findUnique: async () => { readGuard(); return { note }; },
      upsert: async ({ update }: { update: { note: string } }) => { note = update.note; },
      deleteMany: async () => { note = ""; },
    },
    auditLog: {
      create: async ({ data }: { data: { summary: string } }) => {
        if (failAudit) throw new Error("Audit unavailable");
        audits.push(data);
      }
    },
  };
  const prisma = {
    $transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>(resolve => { release = resolve; });
      await previous;
      locked = false;
      beforeTransaction?.(); beforeTransaction = undefined;
      const before = structuredClone(rows); const originalNote = note;
      try { return await run(tx); }
      catch (error) { rows.splice(0, rows.length, ...before); note = originalNote; throw error; }
      finally { locked = false; release(); }
    },
  };
  const { markRegister } = serverModule<typeof import("./register")>("src/lib/attendance/actions/register.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "instructor", name: "Test Instructor" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/attendance/access": { canMarkRegister: () => true },
    "next/cache": { revalidatePath: () => { } },
  });
  const input = () => ({ courseId: "class", date: "2026-08-31", marks: rows.map(row => ({ studentId: row.studentId, status: row.status, note: row.note ?? undefined })), classNote: note, revision: savedRegister("class", "2026-08-31", rows, note).revision });
  return { markRegister, input, rows, audits, updated, beforeTransaction: (fn: () => void) => { beforeTransaction = fn; }, archive: () => { archived = true; }, note: () => note, failAudit: () => { failAudit = true; } };
}

test("unchanged attendance produces no writes or audit entries", async () => {
  const f = fixture();
  assert.equal((await f.markRegister(f.input())).ok, true);
  assert.equal(f.updated.length, 0); assert.equal(f.audits.length, 0);
});

test("editing one mark preserves the other swimmer's original recorder", async () => {
  const f = fixture(); const input = f.input(); input.marks[1].status = "PRESENT";
  assert.equal((await f.markRegister(input)).ok, true);
  assert.deepEqual(f.updated, ["two"]);
  assert.equal(f.rows[0].markedById, "original");
  assert.equal(f.rows[1].markedById, "instructor");
});

test("note-only changes are saved and all changes roll back if auditing fails", async () => {
  const f = fixture(); const input = f.input(); input.marks[0].note = "Test note";
  assert.equal((await f.markRegister(input)).ok, true);
  assert.match(f.audits[0].summary, /Test note/);
  f.failAudit(); const failed = f.input(); failed.marks[1].status = "PRESENT"; failed.classNote = "Changed class note";
  await assert.rejects(f.markRegister(failed), /Audit unavailable/);
  assert.equal(f.rows[1].status, "ABSENT"); assert.equal(f.note(), "Original class note");
});

test("duplicate swimmers and impossible dates fail before writes", async () => {
  const f = fixture(); const input = f.input(); input.marks.push(input.marks[0]);
  assert.equal((await f.markRegister(input)).ok, false);
  assert.equal((await f.markRegister({ ...f.input(), date: "2026-02-31" })).ok, false);
  assert.equal(f.updated.length, 0);
});

test("two staff saving one revision cannot overwrite each other", async () => {
  const f = fixture(); const first = f.input(); const second = f.input();
  first.marks[1].status = "PRESENT"; second.marks[1].status = "LATE";
  const [saved, blocked] = await Promise.all([f.markRegister(first), f.markRegister(second)]);
  assert.equal(saved.ok, true); assert.equal(blocked.ok, false);
  assert.equal(f.rows[1].status, "PRESENT"); assert.equal(f.audits.length, 1);
  if (blocked.ok) return;
  assert.equal(blocked.conflict?.marks.two.status, "PRESENT");
  assert.equal((await f.markRegister({ ...second, revision: blocked.conflict!.revision })).ok, true);
  assert.equal(f.rows[1].status, "LATE");
});

test("a lost-response retry is idempotent and a stale class note cannot replace a saved note", async () => {
  const f = fixture(); const first = f.input(); const stale = f.input();
  first.classNote = "Saved by another staff member";
  assert.equal((await f.markRegister(first)).ok, true);
  assert.equal((await f.markRegister(first)).ok, true);
  assert.equal(f.audits.length, 1);
  stale.classNote = "Older draft";
  const blocked = await f.markRegister(stale);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.conflict?.note, first.classNote);
  assert.equal(f.note(), first.classNote);
});

test("a draft without a revision requires review, and an intervening archive is checked under lock", async () => {
  const f = fixture(); const input = f.input(); input.marks[0].status = "LATE";
  assert.equal((await f.markRegister({ ...input, revision: null })).ok, false);
  assert.equal(f.updated.length, 0);
  f.beforeTransaction(f.archive);
  assert.equal((await f.markRegister(input)).ok, false);
  assert.equal(f.updated.length, 0);
});

test("the first register saves against an empty revision and returns its new revision", async () => {
  const f = fixture(); const input = f.input(); f.rows.length = 0;
  input.revision = savedRegister("class", input.date, [], input.classNote).revision;
  const result = await f.markRegister(input);
  assert.equal(result.ok, true); assert.equal(f.rows.length, 2);
  if (result.ok) assert.equal(result.revision, f.input().revision);
});
