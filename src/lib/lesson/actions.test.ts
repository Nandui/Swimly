import assert from "node:assert/strict";
import test from "node:test";
import { serverModule } from "@/test/server-module";
import { Prisma } from "@/generated/prisma/client";
import { lessonRevision } from "./revision";
import type { LessonData, LessonSaveInput } from "./schema";

function fixture() {
  let data: LessonData = {
    attendance: { one: { status: null, note: "" }, two: { status: null, note: "" } },
    competencies: { one: { skill: null }, two: { skill: null } },
    note: "",
  };
  let complete = false;
  let allowMark = true;
  let allowAssess = true;
  let available = true;
  let auditFails = false;
  let authorized = false;
  let locked = false;
  let resultLocks = 0;
  const audits: { action: string; entityId: string; summary: string }[] = [];
  const writes: string[] = [];
  const saved = () => ({ data: structuredClone(data), complete, revision: lessonRevision([data, complete]) });
  const input = (): LessonSaveInput => ({ courseId: "class", date: "2026-08-31", revision: saved().revision, data: structuredClone(data) });
  const tx = {
    $queryRaw: async (query: { values: unknown[] }) => {
      assert.ok(authorized && locked && allowMark && available);
      assert.deepEqual(query.values, ["one", "two"], "lock the trusted roster only");
      resultLocks++;
    },
    student: { findMany: async () => ["one", "two"].map(id => ({ id, firstName: "Test", lastName: id })) },
    attendanceRecord: {
      upsert: async ({ create }: { create: { studentId: string; status: "PRESENT"; note: string | null } }) => {
        writes.push(create.studentId);
        data.attendance[create.studentId] = { status: create.status, note: create.note ?? "" };
      },
      deleteMany: async ({ where }: { where: { studentId: string } }) => {
        writes.push(where.studentId); data.attendance[where.studentId] = { status: null, note: "" };
      },
    },
    classNote: {
      upsert: async ({ create }: { create: { note: string } }) => { data.note = create.note; },
      deleteMany: async () => { data.note = ""; },
    },
    attendanceCompletion: {
      deleteMany: async () => { complete = false; },
      upsert: async () => { complete = true; },
    },
    competencyResult: {
      create: async ({ data: record }: { data: { studentId: string; competencyId: string; status: "ACHIEVED" } }) => {
        data.competencies[record.studentId][record.competencyId] = record.status;
      },
    },
    auditLog: { create: async ({ data: audit }: { data: (typeof audits)[number] }) => {
      if (auditFails) throw new Error("Audit unavailable");
      audits.push(audit);
    } },
  };
  const readLesson = async (_tx: unknown, courseId: string, date: string, clubId: string) => {
    assert.ok(authorized && locked, "permission and course lock precede reads");
    assert.deepEqual([courseId, date, clubId], ["class", "2026-08-31", "club"]);
    if (!available) return null;
    return {
      course: { name: "Test class", dayOfWeek: "MONDAY", startMinutes: 900, instructorId: "staff", archivedAt: null,
        level: { name: "Test level", archivedAt: null, programmeId: "programme", programme: { archivedAt: null }, competencies: [{ id: "skill", name: "Float" }] } },
      cover: null, ids: ["one", "two"], results: [], fingerprint: lessonRevision(data.attendance), saved: saved(),
    };
  };
  const { saveLesson } = serverModule<typeof import("./actions")>("src/lib/lesson/actions.ts", {
    "@/generated/prisma/client": { Prisma },
    "@/lib/prisma": { prisma: {} },
    "./data": { readLesson },
    "@/lib/authz": {
      requirePermission: async (permission: string) => { assert.equal(permission, "attendance.mark"); authorized = true; return { user: { id: "staff", name: "Test Staff" } }; },
      can: (_session: unknown, permission: string) => { assert.equal(permission, "progression.assess"); return allowAssess; },
      AuthorizationError: class extends Error {},
    },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/attendance/access": { canMarkRegister: () => allowMark },
    "@/lib/enrolment/seat": { withCourseSeat: async (id: string, run: (db: typeof tx) => Promise<unknown>) => {
      assert.equal(id, "class"); locked = true;
      const before = structuredClone(data); const wasComplete = complete; const auditCount = audits.length;
      try { return await run(tx); }
      catch (error) { data = before; complete = wasComplete; audits.length = auditCount; throw error; }
      finally { locked = false; }
    } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { saveLesson, input, saved, audits, writes, resultLocks: () => resultLocks,
    denyMark: () => { allowMark = false; }, denyAssess: () => { allowAssess = false; },
    removeClass: () => { available = false; }, failAudit: () => { auditFails = true; },
    changeRoster: () => { data.attendance.three = { status: null, note: "" }; data.competencies.three = { skill: null }; },
  };
}

test("opening or retrying an unchanged lesson writes neither defaults nor audits", async () => {
  const f = fixture(); assert.equal((await f.saveLesson(f.input())).ok, true);
  assert.deepEqual(f.writes, []); assert.deepEqual(f.audits, []); assert.equal(f.saved().complete, false);
});

test("an unmarked attendance note cannot be silently discarded or saved as default presence", async () => {
  const f = fixture(); const input = f.input(); input.data.attendance.one.note = "Keep this note";
  const result = await f.saveLesson(input); assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Choose Present, Late or Absent/);
  assert.deepEqual(f.writes, []); assert.equal(input.data.attendance.one.note, "Keep this note");
});

test("marks save independently; completion requires saved marks and explicit confirmation", async () => {
  const f = fixture();
  assert.equal((await f.saveLesson({ ...f.input(), complete: true })).ok, false);
  const marks = f.input(); Object.values(marks.data.attendance).forEach(mark => { mark.status = "PRESENT"; });
  assert.equal((await f.saveLesson({ ...marks, complete: true })).ok, false);
  assert.equal((await f.saveLesson(marks)).ok, true); assert.equal(f.saved().complete, false);
  const confirmation = { ...f.input(), complete: true };
  assert.equal((await f.saveLesson(confirmation)).ok, true); assert.equal(f.saved().complete, true);
  assert.equal((await f.saveLesson(confirmation)).ok, true);
  assert.equal(f.audits.filter(audit => audit.action === "attendance-complete").length, 1);
  const next = f.input(); next.data.attendance.one.status = "LATE";
  assert.equal((await f.saveLesson(next)).ok, true); assert.equal(f.saved().complete, false);
  assert.match(f.audits.at(-1)!.summary, /attendance reopened/);
});

test("stale saves return the current version and lost-response retries do not duplicate audits", async () => {
  const f = fixture(); const first = f.input(); const stale = f.input();
  first.data.attendance.one.status = "PRESENT"; stale.data.attendance.one.status = "ABSENT";
  assert.equal((await f.saveLesson(first)).ok, true);
  assert.equal((await f.saveLesson(first)).ok, true); assert.equal(f.audits.length, 1);
  const result = await f.saveLesson(stale); assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.conflict?.data.attendance.one.status, "PRESENT");
  assert.equal(f.audits.length, 1);
});

test("changed or forged rosters require review without locking browser-supplied IDs", async () => {
  const f = fixture(); const forged = f.input(); forged.data.competencies.stranger = { skill: "ACHIEVED" };
  const result = await f.saveLesson(forged); assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.conflict);
  const old = f.input(); f.changeRoster(); const changed = await f.saveLesson(old);
  assert.equal(changed.ok, false); assert.deepEqual(f.writes, []);
});

test("class and assessment permissions are enforced before writes", async () => {
  for (const deny of ["denyMark", "removeClass"] as const) {
    const f = fixture(); f[deny](); const input = f.input(); input.data.attendance.one.status = "PRESENT";
    assert.equal((await f.saveLesson(input)).ok, false); assert.equal(f.resultLocks(), 0);
  }
  const f = fixture(); f.denyAssess(); const input = f.input(); input.data.competencies.one.skill = "ACHIEVED";
  assert.equal((await f.saveLesson(input)).ok, false); assert.deepEqual(f.audits, []);
});

test("audit failure rolls back attendance, completion and competencies together", async () => {
  const f = fixture(); f.failAudit(); const input = f.input();
  input.data.attendance.one.status = "PRESENT"; input.data.competencies.one.skill = "ACHIEVED";
  const result = await f.saveLesson(input); assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.retry, true);
  assert.equal(f.saved().data.attendance.one.status, null); assert.equal(f.saved().data.competencies.one.skill, null);
  assert.equal(f.saved().complete, false); assert.deepEqual(f.audits, []);
});

test("competency edits retain attendance confirmation and record their own audit", async () => {
  const f = fixture(); const input = f.input(); Object.values(input.data.attendance).forEach(mark => { mark.status = "PRESENT"; });
  await f.saveLesson(input); await f.saveLesson({ ...f.input(), complete: true });
  const progress = f.input(); progress.data.competencies.one.skill = "ACHIEVED";
  assert.equal((await f.saveLesson(progress)).ok, true); assert.equal(f.saved().complete, true);
  assert.equal(f.audits.at(-1)!.action, "assess"); assert.equal(f.audits.at(-1)!.entityId, "one");
});
