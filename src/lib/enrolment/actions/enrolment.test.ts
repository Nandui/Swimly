import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Actions = typeof import("./enrolment");
type Course = { id: string; clubId: string; levelId: string; capacity: number; archivedAt: Date | null; name: string; dayOfWeek: "MONDAY"; startMinutes: number; level: { id: string; name: string; programmeId: string; archivedAt: Date | null; programme: { archivedAt: Date | null } } };

function fixture() {
  const courses: Course[] = ["a", "b", "c"].map((id) => ({
    id, clubId: "club", levelId: "entry", capacity: 2, archivedAt: null,
    name: `Class ${id}`, dayOfWeek: "MONDAY", startMinutes: 900,
    level: { id: "entry", name: "Entry", programmeId: "programme", archivedAt: null, programme: { archivedAt: null } },
  }));
  const student = { id: "swimmer", clubId: "club", firstName: "Test", lastName: "Swimmer", status: "ACTIVE" };
  const rows = [{ id: "source", studentId: "swimmer", courseId: "a", programmeId: "programme", levelId: "entry", status: "ACTIVE", placementReason: null as string | null }];
  const audits: object[] = [];
  const locks: string[][] = [];
  let activeLocks: string[] = [];
  let failAudit = false;
  let beforeTransaction: (() => void) | undefined;
  let queue = Promise.resolve();
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray, id: string) => {
      if (parts.join("").includes('"Course"')) activeLocks.push(id);
      return [];
    },
    student: {
      findUnique: async ({ where }: { where: { id: string; clubId: string } }) => {
        assert.ok(activeLocks.length > 0, "student read follows the seat lock");
        return where.id === student.id && where.clubId === student.clubId ? student : null;
      }
    },
    course: {
      findUnique: async ({ where }: { where: { id: string; clubId: string } }) => {
        assert.ok(activeLocks.includes(where.id), "capacity read follows that class's lock");
        return courses.find((row) => row.id === where.id && row.clubId === where.clubId) ?? null;
      }
    },
    enrolment: {
      findUnique: async ({ where }: { where: { id: string; course?: { clubId: string }; student?: { clubId: string } } }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) return null;
        const course = courses.find((item) => item.id === row.courseId)!;
        if (where.course && where.course.clubId !== course.clubId) return null;
        if (where.student && where.student.clubId !== student.clubId) return null;
        return { ...row, course, student };
      },
      findFirst: async ({ where }: { where: { courseId: string } }) => rows.find((row) => row.courseId === where.courseId && ["ACTIVE", "WAITLISTED"].includes(row.status)) ?? null,
      findMany: async () => rows.filter((row) => row.status === "ACTIVE"),
      count: async ({ where }: { where: { courseId: string } }) => rows.filter((row) => row.courseId === where.courseId && row.status === "ACTIVE").length,
      update: async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(rows.find((row) => row.id === where.id)!, data),
      create: async ({ data }: { data: Omit<(typeof rows)[number], "id"> }) => {
        const row = { ...data, id: `created-${rows.length}` }; rows.push(row); return row;
      },
    },
    level: { findMany: async () => [{ id: "entry", name: "Entry", sortOrder: 0 }, { id: "next", name: "Next", sortOrder: 1 }] },
    levelCompletion: { findMany: async () => [] },
    assessmentBooking: { findMany: async () => [] },
    auditLog: { create: async ({ data }: { data: object }) => { if (failAudit) throw new Error("Audit unavailable"); audits.push(data); } },
  };
  const prisma = {
    ...tx,
    $transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      activeLocks = [];
      beforeTransaction?.();
      beforeTransaction = undefined;
      const snapshot = structuredClone(rows);
      try { return await run(tx); }
      catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
      finally { locks.push([...activeLocks]); release(); }
    },
  };
  const actions = serverModule<Actions>("src/lib/enrolment/actions/enrolment.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Test Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club", currentClubIdIfAny: async () => "club" },
    "next/cache": { revalidatePath: () => { } },
  });
  return {
    actions, rows, courses, student, audits, locks,
    failAudit: () => { failAudit = true; },
    beforeTransaction: (run: () => void) => { beforeTransaction = run; },
  };
}

test("enrolment refuses another club's swimmer without writing", async () => {
  const f = fixture(); f.student.clubId = "other";
  const result = await f.actions.enrolStudent({ studentId: "swimmer", courseId: "b", placementReason: "", allowWaitlist: false });
  assert.equal(result.ok, false); assert.equal(f.rows.length, 1); assert.equal(f.audits.length, 0);
});

test("enrolment sees capacity changed before it obtains the lock", async () => {
  const f = fixture(); f.beforeTransaction(() => { f.courses[1].capacity = 0; });
  const result = await f.actions.enrolStudent({ studentId: "swimmer", courseId: "b", placementReason: "", allowWaitlist: false });
  assert.equal(result.ok, false); assert.equal(f.rows.length, 1);
});

test("two simultaneous transfers only move the original enrolment once", async () => {
  const f = fixture();
  const results = await Promise.all([f.actions.transferEnrolment("source", "b"), f.actions.transferEnrolment("source", "c")]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(f.rows.length, 2); assert.equal(f.audits.length, 1);
  assert.deepEqual(f.locks, [["a", "b"], ["a", "c"]]);
});

test("a transfer needs and stores a reason for an unearned level", async () => {
  const f = fixture(); f.courses[1].levelId = "next"; f.courses[1].level = { ...f.courses[1].level, id: "next", name: "Next" };
  assert.equal((await f.actions.transferEnrolment("source", "b")).ok, false);
  assert.equal(f.rows.length, 1);
  assert.equal((await f.actions.transferEnrolment("source", "b", "Placement agreed with instructor")).ok, true);
  assert.equal(f.rows[1].placementReason, "Placement agreed with instructor");
});

test("promotion cannot reopen a waitlist entry withdrawn while it waited", async () => {
  const f = fixture(); f.rows[0].status = "WAITLISTED";
  f.beforeTransaction(() => { f.rows[0].status = "WITHDRAWN"; });
  assert.equal((await f.actions.promoteFromWaitlist("source")).ok, false);
  assert.equal(f.rows[0].status, "WITHDRAWN"); assert.equal(f.audits.length, 0);
});

test("audit failure rolls back the transfer and its new place", async () => {
  const f = fixture(); f.failAudit();
  await assert.rejects(f.actions.transferEnrolment("source", "b"), /Audit unavailable/);
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].status, "ACTIVE");
});

test("moving a waitlisted swimmer closes the waiting booking without implying attendance", async () => {
  const f = fixture(); f.rows[0].status = "WAITLISTED";
  assert.equal((await f.actions.transferEnrolment("source", "b")).ok, true);
  assert.equal(f.rows[0].status, "WITHDRAWN");
  assert.equal(f.rows[1].status, "ACTIVE");
  assert.match((f.audits[0] as { summary: string }).summary, /from the waitlist for/);
});
