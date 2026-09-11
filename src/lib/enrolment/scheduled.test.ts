import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { parseDateOnly } from "@/lib/format";

function fixture() {
  const row = {
    id: "place", courseId: "class", programmeId: "programme", status: "ACTIVE",
    startedOn: parseDateOnly("2026-09-01"), scheduledEndOn: null as Date | null, endedOn: null as Date | null,
    student: { firstName: "Test", lastName: "Swimmer", clubId: "club" },
    course: { id: "class", clubId: "club", name: "Test Class", dayOfWeek: "MONDAY", startMinutes: 900, level: { name: "Entry" } },
  };
  let day = "2026-09-07";
  let auditFails = false;
  let beforeLock: (() => void) | undefined;
  let locked = false;
  const audits: { summary: string }[] = [];
  const tx = {
    $queryRaw: async () => { locked = true; beforeLock?.(); beforeLock = undefined; return []; },
    enrolment: {
      findUnique: async ({ where }: { where: { id: string; course?: { clubId: string }; student?: { clubId: string } } }) => {
        if (where.id !== row.id || (where.course && where.course.clubId !== row.course.clubId) || (where.student && where.student.clubId !== row.student.clubId)) return null;
        return structuredClone(row);
      },
      findMany: async () => row.status === "ACTIVE" && row.scheduledEndOn && row.scheduledEndOn <= parseDateOnly(day) ? [{ id: row.id, courseId: row.courseId }] : [],
      update: async ({ data }: { data: object }) => { assert.equal(locked, true); Object.assign(row, data); return row; },
    },
    auditLog: { create: async ({ data }: { data: { summary: string } }) => { if (auditFails) throw new Error("Audit failed"); audits.push(data); } },
  };
  const prisma = { ...tx, $transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
    const snapshot = structuredClone(row);
    const auditCount = audits.length;
    try { return await run(tx); }
    catch (error) { Object.assign(row, snapshot); audits.splice(auditCount); throw error; }
    finally { locked = false; }
  } };
  const doubles = {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async (permission: string) => { assert.equal(permission, "enrolment.manage"); return { user: { id: "staff", name: "Test Staff" } }; } },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/format": { ...serverModule<typeof import("@/lib/format")>("src/lib/format.ts", {}), today: () => day },
    "next/cache": { revalidatePath: () => {} },
  };
  const actions = serverModule<typeof import("./actions/schedule")>("src/lib/enrolment/actions/schedule.ts", doubles);
  const worker = serverModule<typeof import("./scheduled")>("src/lib/enrolment/scheduled.ts", doubles);
  return { row, actions, worker, audits, day: (value: string) => { day = value; }, failAudit: () => { auditFails = true; }, beforeLock: (run: () => void) => { beforeLock = run; } };
}

test("scheduling retains the active place until its date and applies exactly once", async () => {
  const f = fixture();
  assert.equal((await f.actions.scheduleUnenrolment("place", "2026-09-10")).ok, true);
  assert.equal(f.row.status, "ACTIVE"); assert.equal(f.row.endedOn, null);
  assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 0 });
  f.day("2026-09-10");
  assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 1 });
  assert.equal(f.row.status, "WITHDRAWN");
  assert.deepEqual(f.row.endedOn, parseDateOnly("2026-09-10"));
  assert.equal(f.row.scheduledEndOn, null);
  assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 0 });
  assert.equal(f.audits.length, 2);
});

test("changing or cancelling a schedule retains the current place", async () => {
  const f = fixture();
  await f.actions.scheduleUnenrolment("place", "2026-09-10");
  await f.actions.scheduleUnenrolment("place", "2026-09-20");
  f.day("2026-09-11");
  assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 0 });
  await f.actions.scheduleUnenrolment("place", null);
  f.day("2026-09-21");
  assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 0 });
  assert.equal(f.row.status, "ACTIVE");
});

test("past, today, invalid dates and ended places are refused; another site is supported", async () => {
  const f = fixture();
  for (const date of ["2026-09-06", "2026-09-07", "2026-02-30", "bad"]) assert.equal((await f.actions.scheduleUnenrolment("place", date)).ok, false);
  f.row.status = "WITHDRAWN";
  assert.equal((await f.actions.scheduleUnenrolment("place", "2026-09-10")).ok, false);
  assert.equal(f.audits.length, 0);
  f.row.status = "ACTIVE"; f.row.course.clubId = "other";
  assert.equal((await f.actions.scheduleUnenrolment("place", "2026-09-10")).ok, true);
  assert.equal(f.audits.length, 1);
});

test("overdue processing preserves the intended date, not the visit date", async () => {
  const f = fixture();
  await f.actions.scheduleUnenrolment("place", "2026-09-10"); f.day("2026-09-15");
  await f.worker.processScheduledUnenrolments();
  assert.deepEqual(f.row.endedOn, parseDateOnly("2026-09-10"));
});

test("a cancellation or transfer winning the lock prevents automatic withdrawal", async () => {
  for (const change of ["cancel", "transfer"]) {
    const f = fixture(); await f.actions.scheduleUnenrolment("place", "2026-09-10"); f.day("2026-09-10");
    f.beforeLock(() => { if (change === "cancel") f.row.scheduledEndOn = null; else f.row.status = "TRANSFERRED"; });
    assert.deepEqual(await f.worker.processScheduledUnenrolments(), { withdrawn: 0 });
    assert.equal(f.audits.length, 1);
  }
});

test("a failed audit rolls back both scheduling and automatic withdrawal", async () => {
  const f = fixture(); f.failAudit();
  await assert.rejects(f.actions.scheduleUnenrolment("place", "2026-09-10"), /Audit failed/);
  assert.equal(f.row.scheduledEndOn, null);
  f.row.scheduledEndOn = parseDateOnly("2026-09-07");
  await assert.rejects(f.worker.processScheduledUnenrolments(), /Audit failed/);
  assert.equal(f.row.status, "ACTIVE"); assert.equal(f.row.endedOn, null);
});
