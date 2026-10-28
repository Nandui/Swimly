import { plannedDouble } from "@/test/planned-double";
import { directoryDouble } from "@/test/directory-double";
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import * as format from "@/lib/format";

type Swimmer = { id: string; studentId: string; swimmerName: string; memberNumber: string | null };
type Row = {
  id: string; courseId: string; clubId: string; date: Date; className: string; reason: string; startMinutes: number; attendanceRecorded: number;
  closureId: string | null; cancelledById: string; cancelledByName: string; cancelledAt: Date;
  billingNotifiedAt: Date | null; legendProcessedAt: Date | null; swimmers: Swimmer[];
};

const COURSES = ["class", "other"];

/** Today is Sunday 13 September 2026, 9:00; "class" runs Sundays at 15:00 and "other" at 16:00. */
function fixture() {
  let allowed = true, club = "site", weekday = "SUNDAY", failAudit = false, locked = false, now = 540;
  const archived = new Set<string>();
  let rows: Row[] = [], rosterName = "Example", queue = Promise.resolve(), nextId = 1;
  const covers = new Set<string>(), audits: { action: string; details?: Record<string, unknown> }[] = [], permissions: string[] = [];
  const iso = (date: Date) => date.toISOString().slice(0, 10), key = (courseId: string, date: Date) => `${courseId}|${iso(date)}`;
  const course = (id: string) => ({ id, name: id === "class" ? "Turtles" : "Seals", archivedAt: archived.has(id) ? new Date() : null, dayOfWeek: weekday,
    startMinutes: id === "class" ? 900 : 960, durationMinutes: 30, location: "Learner pool", instructorId: "scheduled",
    level: { id: "level", name: id === "class" ? "Turtles" : "Seals", programme: { id: "programme", name: "Swim skills" } } });
  const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([field, value]) => {
    const own = row[field as keyof Row];
    if (field === "courseId" && value && typeof value === "object" && "in" in value) return (value.in as string[]).includes(row.courseId);
    if (field === "date" && value instanceof Date) return iso(row.date) === iso(value);
    return own === value;
  });
  const tx = {
    course: { findMany: async ({ where }: { where: { id: { in: string[] }; clubId: string } }) => {
      assert.ok(locked);
      return where.clubId !== "site" ? [] : where.id.in.filter(id => COURSES.includes(id)).map(course);
    } },
    classCancellation: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter(row => matches(row, where)).map(row => structuredClone(row)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => structuredClone(rows.find(row => matches(row, where)) ?? null),
      create: async ({ data }: { data: Omit<Row, "id" | "swimmers" | "cancelledAt" | "billingNotifiedAt" | "legendProcessedAt"> & { swimmers: { create: Omit<Swimmer, "id">[] } } }) => {
        assert.ok(locked);
        const row: Row = { ...structuredClone(data), id: `cancellation-${nextId++}`, cancelledAt: new Date(), billingNotifiedAt: null, legendProcessedAt: null,
          swimmers: data.swimmers.create.map((s, i) => ({ ...s, id: `swimmer-row-${i}` })) };
        rows.push(row); return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => { assert.ok(locked); const row = rows.find(r => r.id === where.id)!; Object.assign(row, data); return row; },
      delete: async ({ where }: { where: { id: string } }) => { assert.ok(locked); rows = rows.filter(r => r.id !== where.id); },
    },
    cancelledClassSwimmer: { deleteMany: async () => { assert.ok(locked); } },
    enrolment: { findMany: async ({ where }: { where: { status: string; AND: unknown[] } }) => {
      assert.ok(locked); assert.equal(where.status, "ACTIVE"); assert.equal(where.AND.length, 2);
      return [1, 1, 2].map(id => ({ student: { id: `swimmer-${id}`, firstName: `Synthetic ${id}`, lastName: rosterName, memberNumber: `TEST-${id}` } }));
    } },
    classCover: { findUnique: async ({ where }: { where: { courseId_date: { courseId: string; date: Date } } }) => {
      const k = key(where.courseId_date.courseId, where.courseId_date.date); return covers.has(k) ? { id: k, coverByName: "Cover teacher" } : null;
    } },
    attendanceRecord: { count: async () => 0 },
  };
  const actions = serverModule<typeof import("@/modules/activities/shared/cancellations/actions")>("src/modules/activities/shared/cancellations/actions.ts", {
    "@/modules/activities/shared/courses/planned": plannedDouble(), "@/lib/directory": directoryDouble({ people: [{ id: "scheduled", name: "Scheduled teacher" }] }),
    "@/lib/authz": { requirePermission: async (permission: string) => { permissions.push(permission); if (!allowed) throw Error("denied"); return { user: { id: "manager", name: "Duty Manager" } }; }, canSee: () => true, AuthorizationError: Error },
    "@/lib/clubs/current": { currentClubId: async () => club },
    "@/lib/prisma": { prisma: tx },
    "@/modules/activities/shared/curriculum/data/shared": { readSharedCurriculum: async () => ({}), sharedCourse: (row: unknown) => row },
    "@/lib/format": { ...format, today: () => "2026-09-13", minutesNow: () => now, weekdayOf: () => "SUNDAY" },
    "@/modules/activities/shared/enrolment/seat": { withCourseSeat: async (_ids: unknown, run: (db: typeof tx) => Promise<unknown>) => {
      const before = queue; let release!: () => void; queue = new Promise<void>(r => { release = r; }); await before; locked = true;
      const snapshot = structuredClone(rows), auditCount = audits.length;
      try { return await run(tx); } catch (e) { rows = snapshot; audits.splice(auditCount); throw e; } finally { locked = false; release(); }
    } },
    "@/lib/audit": { logAudit: async (row: { action: string }, db: unknown) => { assert.equal(db, tx); if (failAudit) throw Error("audit failed"); audits.push(row); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, audits, permissions, rows: () => rows, row: () => rows[0] ?? null,
    deny: () => { allowed = false; }, wrongSite: () => { club = "other"; }, archive: (id = "class") => { archived.add(id); }, wrongDay: () => { weekday = "MONDAY"; },
    failAudit: () => { failAudit = true; }, renameSwimmer: () => { rosterName = "Changed"; }, at: (minutes: number) => { now = minutes; },
    cover: (courseId: string, day: string) => { covers.add(`${courseId}|${day}`); },
    notify: (id: string) => { rows.find(r => r.id === id)!.billingNotifiedAt = new Date(); } };
}
const input = { courseId: "class", date: "2026-09-13", reason: "Pool closure" };
const ahead = { ...input, date: "2026-09-27" };
const notification = { courseId: "class", cancellationId: "cancellation-1", note: "Billing team notified in the daily handoff." };

test("cancellation freezes one deduplicated roster and concurrent retries create one billing task", async () => {
  const f = fixture();
  assert.ok((await Promise.all([f.actions.cancelClassSession(input), f.actions.cancelClassSession(input)])).every(r => r.ok));
  assert.equal(f.audits.length, 1); assert.equal(f.audits[0].action, "cancel-session");
  assert.deepEqual(f.permissions, ["classes.cancel", "classes.cancel"]);
  assert.equal(f.row()?.swimmers.length, 2); assert.equal(f.row()?.closureId, null);
  f.renameSwimmer(); await f.actions.cancelClassSession({ ...input, reason: "Changed reason" });
  assert.equal(f.row()?.reason, "Pool closure"); assert.equal(f.row()?.swimmers[0].swimmerName, "Synthetic 1 Example");
});

test("a session can be cancelled today or up to four weeks ahead, never before or beyond", async () => {
  const f = fixture();
  assert.ok((await f.actions.cancelClassSession(ahead)).ok);
  assert.ok((await f.actions.cancelClassSession({ ...input, date: "2026-10-11" })).ok); // 28 days ahead
  for (const date of ["2026-09-12", "2026-10-12"]) assert.equal((await f.actions.cancelClassSession({ ...input, date })).ok, false);
  assert.deepEqual(f.rows().map(r => r.date.toISOString().slice(0, 10)), ["2026-09-27", "2026-10-11"]);
});

test("authorization, site, schedule and required reason guard cancellation before writes", async () => {
  const denied = fixture(); denied.deny(); await assert.rejects(denied.actions.cancelClassSession(input)); assert.equal(denied.row(), null);
  for (const configure of [(f: ReturnType<typeof fixture>) => f.wrongSite(), (f: ReturnType<typeof fixture>) => f.archive(), (f: ReturnType<typeof fixture>) => f.wrongDay()]) {
    const f = fixture(); configure(f); assert.equal((await f.actions.cancelClassSession(input)).ok, false); assert.equal(f.row(), null);
  }
  const f = fixture();
  for (const bad of [{ ...input, date: "13/09/2026" }, { ...input, reason: " " }]) assert.equal((await f.actions.cancelClassSession(bad)).ok, false);
  assert.equal(f.audits.length, 0);
});

test("audit failures roll back the cancellation and the billing handoff", async () => {
  const f = fixture(); f.failAudit(); await assert.rejects(f.actions.cancelClassSession(input), /audit failed/); assert.equal(f.row(), null);
  const g = fixture(); await g.actions.cancelClassSession(input); g.failAudit(); await assert.rejects(g.actions.markBillingNotified(notification), /audit failed/); assert.equal(g.row()?.billingNotifiedAt, null);
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

test("closing a day links its classes, skips ones already cancelled, and a stale class cancels nothing", async () => {
  const f = fixture(); await f.actions.cancelClassSession(ahead);
  assert.ok((await f.actions.cancelClassSessions({ courseIds: COURSES, date: ahead.date, reason: "Gala", closeDay: true })).ok);
  const [single, closed] = f.rows();
  assert.equal(single.closureId, null); assert.equal(single.reason, "Pool closure");
  assert.equal(closed.courseId, "other"); assert.ok(closed.closureId);
  assert.ok((await f.actions.cancelClassSessions({ courseIds: COURSES, date: ahead.date, reason: "Gala", closeDay: true })).ok);
  assert.equal(f.rows().length, 2);
  const g = fixture(); g.archive("other");
  assert.equal((await g.actions.cancelClassSessions({ courseIds: COURSES, date: ahead.date, reason: "Gala", closeDay: true })).ok, false);
  assert.equal(g.rows().length, 0);
  assert.equal((await g.actions.cancelClassSessions({ courseIds: [], date: ahead.date, reason: "Gala", closeDay: false })).ok, false);
});

test("undo removes a cancellation before billing acts and before the class starts, keeping it all in the audit", async () => {
  const f = fixture(); await f.actions.cancelClassSession(ahead);
  assert.ok((await f.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok);
  assert.equal(f.rows().length, 0);
  const undo = f.audits.find(a => a.action === "uncancel-session");
  assert.equal(undo?.details?.reason, "Pool closure"); assert.equal((undo?.details?.swimmers as unknown[]).length, 2);
  assert.equal((await f.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok, false); // gone: not at this site
  assert.ok((await f.actions.cancelClassSession(ahead)).ok); // can be cancelled again
});

test("undo is refused once billing has acted, the class has started, or a teacher is recorded", async () => {
  const notified = fixture(); await notified.actions.cancelClassSession(ahead); notified.notify("cancellation-1");
  assert.equal((await notified.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok, false);
  assert.equal(notified.rows().length, 1);
  const started = fixture(); await started.actions.cancelClassSession(input); started.at(900); // 15:00, its start
  assert.equal((await started.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok, false);
  started.at(899); assert.ok((await started.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok);
  const covered = fixture(); await covered.actions.cancelClassSession(input); covered.cover("class", "2026-09-13");
  assert.equal((await covered.actions.undoCancellation({ cancellationId: "cancellation-1" })).ok, false);
  assert.equal(covered.audits.filter(a => a.action === "uncancel-session").length, 0);
});

test("reopening a day puts back what it can and names the classes that stay cancelled", async () => {
  const f = fixture();
  await f.actions.cancelClassSessions({ courseIds: COURSES, date: ahead.date, reason: "Gala", closeDay: true });
  const closureId = f.row()!.closureId!;
  f.notify(f.rows().find(r => r.courseId === "other")!.id);
  const result = await f.actions.undoClosure({ closureId });
  assert.equal(result.ok, false); assert.match(result.ok ? "" : result.error, /Seals/);
  assert.deepEqual(f.rows().map(r => r.courseId), ["other"]);
  const g = fixture(); await g.actions.cancelClassSessions({ courseIds: COURSES, date: ahead.date, reason: "Gala", closeDay: true });
  assert.ok((await g.actions.undoClosure({ closureId: g.row()!.closureId! })).ok); assert.equal(g.rows().length, 0);
  assert.equal(g.audits.filter(a => a.action === "uncancel-session").length, 2);
});
