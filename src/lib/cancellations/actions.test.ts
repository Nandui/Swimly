import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

function fixture() {
  let allowed = true, screen = true, club = "site", archived = false, weekday = "SUNDAY", failAudit = false, locked = false;
  type Row = { id: string; courseId: string; clubId: string; date: Date; className: string; reason: string; swimmers: { create: { studentId: string; swimmerName: string; memberNumber: string }[] }; billingNotifiedAt?: Date };
  let stored: Row | null = null, rosterName = "Example", queue = Promise.resolve();
  const audits: { action: string }[] = [], permissions: string[] = [];
  const tx = {
    course: { findUnique: async ({ where }: { where: { clubId: string } }) => {
      assert.ok(locked);
      return where.clubId !== "site" ? null : { id: "class", name: "Turtles", archivedAt: archived ? new Date() : null, dayOfWeek: weekday,
        startMinutes: 900, durationMinutes: 30, location: "Learner pool", instructor: { name: "Scheduled teacher" },
        level: { id: "level", name: "Turtles", programme: { id: "programme", name: "Swim skills" } } };
    } },
    classCancellation: {
      findUnique: async () => { assert.ok(locked); return stored; },
      findFirst: async ({ where }: { where: { id: string; courseId: string; clubId: string } }) => stored && stored.id === where.id && stored.courseId === where.courseId && stored.clubId === where.clubId ? stored : null,
      create: async ({ data }: { data: Omit<Row, "id"> }) => { assert.ok(locked); stored = structuredClone({ ...data, id: "cancellation" }); return stored; },
      update: async ({ data }: { data: { billingNotifiedAt: Date } }) => { assert.ok(locked); Object.assign(stored!, data); return stored; },
    },
    enrolment: { findMany: async ({ where }: { where: { status: string; startedOn: { lte: Date }; AND: unknown[] } }) => {
      assert.ok(locked); assert.equal(where.status, "ACTIVE"); assert.equal(where.startedOn.lte.toISOString().slice(0, 10), "2026-09-13"); assert.equal(where.AND.length, 2);
      return [1, 1, 2].map(id => ({ student: { id: `swimmer-${id}`, firstName: `Synthetic ${id}`, lastName: rosterName, memberNumber: `TEST-${id}` } }));
    } },
    classCover: { findUnique: async () => ({ coverByName: "Cover teacher" }) },
    attendanceRecord: { count: async () => 2 },
  };
  const actions = serverModule<typeof import("./actions")>("src/lib/cancellations/actions.ts", {
    "@/lib/authz": { requirePermission: async (key: string) => { permissions.push(key); if (!allowed) throw Error("denied"); return { user: { id: "manager", name: "Duty Manager" } }; }, canSee: () => screen, AuthorizationError: Error },
    "@/lib/clubs/current": { currentClubId: async () => club },
    "@/lib/curriculum/data/shared": { readSharedCurriculum: async () => ({}), sharedCourse: (course: unknown) => course },
    "@/lib/format": { today: () => "2026-09-13", isDateOnly: (iso: string) => /^2026-09-\d{2}$/.test(iso), parseDateOnly: (iso: string) => new Date(iso), weekdayOf: () => "SUNDAY", formatDate: (date: Date) => date.toISOString().slice(0, 10) },
    "@/lib/enrolment/seat": { withCourseSeat: async (_id: string, run: (db: typeof tx) => Promise<unknown>) => {
      const before = queue; let release!: () => void; queue = new Promise<void>(r => { release = r; }); await before; locked = true;
      const snapshot = structuredClone(stored), auditCount = audits.length;
      try { return await run(tx); } catch (e) { stored = snapshot; audits.splice(auditCount); throw e; } finally { locked = false; release(); }
    } },
    "@/lib/audit": { logAudit: async (row: { action: string }, db: unknown) => { assert.equal(db, tx); if (failAudit) throw Error("audit failed"); audits.push(row); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, audits, permissions, row: () => stored, deny: () => { allowed = false; }, denyScreen: () => { screen = false; }, wrongSite: () => { club = "other"; }, archive: () => { archived = true; }, wrongDay: () => { weekday = "MONDAY"; }, failAudit: () => { failAudit = true; }, renameSwimmer: () => { rosterName = "Changed"; } };
}
const input = { courseId: "class", date: "2026-09-13", reason: "Pool closure" };
const notification = { courseId: "class", cancellationId: "cancellation", note: "Billing team notified in the daily handoff." };

test("cancellation freezes one deduplicated roster and concurrent retries create one billing task", async () => {
  const f = fixture();
  assert.ok((await Promise.all([f.actions.cancelClassSession(input), f.actions.cancelClassSession(input)])).every(r => r.ok));
  assert.equal(f.audits.length, 1); assert.equal(f.audits[0].action, "cancel-session");
  assert.deepEqual(f.permissions, ["classes.cancel", "classes.cancel"]);
  assert.equal(f.row()?.swimmers.create.length, 2);
  f.renameSwimmer(); await f.actions.cancelClassSession({ ...input, reason: "Changed reason" });
  assert.equal(f.row()?.reason, "Pool closure"); assert.equal(f.row()?.swimmers.create[0].swimmerName, "Synthetic 1 Example");
});

test("authorization, site, schedule and required reason guard cancellation before writes", async () => {
  for (const configure of [(f: ReturnType<typeof fixture>) => f.deny(), (f: ReturnType<typeof fixture>) => f.denyScreen()]) {
    const f = fixture(); configure(f); await assert.rejects(f.actions.cancelClassSession(input)); assert.equal(f.row(), null);
  }
  for (const configure of [(f: ReturnType<typeof fixture>) => f.wrongSite(), (f: ReturnType<typeof fixture>) => f.archive(), (f: ReturnType<typeof fixture>) => f.wrongDay()]) {
    const f = fixture(); configure(f); assert.equal((await f.actions.cancelClassSession(input)).ok, false); assert.equal(f.row(), null);
  }
  const f = fixture();
  for (const bad of [{ ...input, date: "2026-09-12" }, { ...input, date: "2026-09-14" }, { ...input, reason: " " }]) assert.equal((await f.actions.cancelClassSession(bad)).ok, false);
  assert.equal(f.audits.length, 0);
});

test("audit failures roll back the cancellation and the billing handoff", async () => {
  const f = fixture(); f.failAudit(); await assert.rejects(f.actions.cancelClassSession(input), /audit failed/); assert.equal(f.row(), null);
  const g = fixture(); await g.actions.cancelClassSession(input); g.failAudit(); await assert.rejects(g.actions.markBillingNotified(notification), /audit failed/); assert.equal(g.row()?.billingNotifiedAt, undefined);
});

test("billing requires its permission, site and handoff note; concurrent retries preserve one notification", async () => {
  const f = fixture(); await f.actions.cancelClassSession(input);
  assert.equal((await f.actions.markBillingNotified({ ...notification, note: " " })).ok, false);
  assert.equal((await f.actions.markBillingNotified({ ...notification, courseId: "another-class" })).ok, false);
  await Promise.all([f.actions.markBillingNotified(notification), f.actions.markBillingNotified(notification)]);
  assert.ok(f.row()?.billingNotifiedAt); assert.equal(f.audits.filter(a => a.action === "billing-notified").length, 1);
  assert.ok(f.permissions.includes("billing.notify"));
  const g = fixture(); await g.actions.cancelClassSession(input); g.wrongSite(); assert.equal((await g.actions.markBillingNotified(notification)).ok, false);
  const h = fixture(); await h.actions.cancelClassSession(input); h.deny(); await assert.rejects(h.actions.markBillingNotified(notification));
});
