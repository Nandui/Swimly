import { plannedDouble } from "@/test/planned-double";
import { directoryDouble } from "@/test/directory-double";
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import * as format from "@/lib/format";

type Merge = { id: string; clubId: string; date: Date; fromCourseId: string; intoCourseId: string; fromClassName: string; intoClassName: string; reason: string;
  swimmers: { create: { studentId: string; swimmerName: string }[] } | { studentId: string }[] };

function fixture() {
  let merges: Merge[] = [], failAudit = false;
  const attendance: { courseId: string; studentId: string }[] = [], cancelled: string[] = [];
  let locked: string[] = [], queue = Promise.resolve();
  const audits: { action: string; summary: string }[] = [];
  const course = (id: string, levelId: string, dayOfWeek = "SUNDAY") => ({ id, clubId: "site", levelId, name: null, dayOfWeek, startMinutes: id === "early" ? 900 : 960,
    durationMinutes: 30, location: "Learner pool", capacity: 8, instructorId: "teacher", archivedAt: null,
    level: { id: levelId, name: levelId === "turtles" ? "Turtles" : "Dolphins", programme: { id: "programme", name: "Swim skills" } } });
  const courses = [course("early", "turtles"), course("late", "turtles"), course("other", "dolphins"), course("third", "turtles"), course("monday", "turtles", "MONDAY")];
  const tx = {
    course: { findMany: async ({ where }: { where: { id: { in: string[] }; clubId: string } }) => courses.filter(c => where.id.in.includes(c.id) && c.clubId === where.clubId) },
    classMerge: {
      findUnique: async ({ where }: { where: { fromCourseId_date: { fromCourseId: string } } }) => merges.find(m => m.fromCourseId === where.fromCourseId_date.fromCourseId) ?? null,
      findFirst: async ({ where }: { where: { id: string; clubId: string } }) => {
        const m = merges.find(row => row.id === where.id && row.clubId === where.clubId);
        return m && { ...m, swimmers: "create" in m.swimmers ? m.swimmers.create.map(s => ({ studentId: s.studentId })) : m.swimmers };
      },
      count: async ({ where }: { where: { intoCourseId: string } }) => merges.filter(m => m.intoCourseId === where.intoCourseId).length,
      create: async ({ data }: { data: Omit<Merge, "id"> }) => { assert.equal(locked.length, 2); const row = { ...data, id: `merge-${merges.length + 1}` }; merges.push(row); return row; },
      delete: async ({ where }: { where: { id: string } }) => { assert.equal(locked.length, 2); merges = merges.filter(m => m.id !== where.id); },
    },
    classCancellation: { findMany: async ({ where }: { where: { courseId: { in: string[] } } }) => cancelled.filter(id => where.courseId.in.includes(id)).map(courseId => ({ courseId })) },
    attendanceRecord: { count: async ({ where }: { where: { courseId: string; studentId?: { in: string[] } } }) =>
      attendance.filter(a => a.courseId === where.courseId && (!where.studentId || where.studentId.in.includes(a.studentId))).length },
    enrolment: { findMany: async ({ where }: { where: { courseId: string; status: string } }) => {
      assert.equal(where.status, "ACTIVE");
      return (where.courseId === "early" ? [1, 1, 2] : [3]).map(n => ({ student: { id: `swimmer-${n}`, firstName: "Synthetic", lastName: `${n}`, memberNumber: null } }));
    } },
    classCover: { findUnique: async () => null },
  };
  const actions = serverModule<typeof import("@/modules/activities/shared/merges/actions")>("src/modules/activities/shared/merges/actions.ts", {
    "@/modules/activities/shared/courses/planned": plannedDouble(),
    "@/lib/directory": directoryDouble({ people: [{ id: "teacher", name: "Example Teacher" }] }),
    "@/lib/authz": { requirePermission: async (key: string) => { assert.equal(key, "classes.cancel"); return { user: { id: "manager", name: "Duty Manager" } }; }, canSee: () => true, AuthorizationError: Error },
    "@/lib/clubs/current": { currentClubId: async () => "site" },
    "@/lib/prisma": { prisma: tx },
    "@/modules/activities/shared/curriculum/data/shared": { readSharedCurriculum: async () => ({}), sharedCourse: (c: unknown) => c },
    "@/lib/format": { ...format, today: () => "2026-09-13", parseDateOnly: (iso: string) => new Date(iso), weekdayOf: () => "SUNDAY" },
    "@/modules/activities/shared/enrolment/seat": { withCourseSeat: async (ids: string[], run: (db: typeof tx) => Promise<unknown>) => {
      const before = queue; let release!: () => void; queue = new Promise<void>(r => { release = r; }); await before; locked = [...ids];
      const snapshot = [...merges], auditCount = audits.length;
      try { return await run(tx); } catch (e) { merges = snapshot; audits.splice(auditCount); throw e; } finally { locked = []; release(); }
    } },
    "@/lib/audit": { logAudit: async (row: { action: string; summary: string }, db: unknown) => { assert.equal(db, tx); if (failAudit) throw Error("audit failed"); audits.push(row); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, audits, merges: () => merges, mark: (courseId: string, studentId: string) => attendance.push({ courseId, studentId }),
    cancel: (id: string) => cancelled.push(id), failAudit: () => { failAudit = true; } };
}
const input = { fromCourseId: "early", intoCourseId: "late", date: "2026-09-13", reason: "Not enough instructors" };

test("a merge freezes the moved swimmers once, locks both classes and retries land once", async () => {
  const f = fixture();
  assert.ok((await Promise.all([f.actions.mergeClassSession(input), f.actions.mergeClassSession(input)])).every(r => r.ok));
  assert.equal(f.merges().length, 1); assert.equal(f.audits.length, 1); assert.equal(f.audits[0].action, "merge-session");
  const swimmers = f.merges()[0].swimmers as { create: { studentId: string }[] };
  assert.deepEqual(swimmers.create.map(s => s.studentId), ["swimmer-1", "swimmer-2"]);
  assert.match(f.audits[0].summary, /Merged .* into .* Not enough instructors\. 2 swimmers moved/);
  const again = await f.actions.mergeClassSession({ ...input, intoCourseId: "other" });
  assert.equal(again.ok, false);
});

test("merges need the same level, today, two different running classes and no attendance yet", async () => {
  const f = fixture();
  const error = async (patch: Partial<typeof input>) => { const r = await f.actions.mergeClassSession({ ...input, ...patch }); assert.equal(r.ok, false); return r.ok ? "" : r.error; };
  assert.match(await error({ intoCourseId: "other" }), /same level/);
  assert.match(await error({ intoCourseId: "early" }), /different class/);
  assert.match(await error({ date: "2026-09-20" }), /today/);
  assert.match(await error({ intoCourseId: "missing" }), /no longer active/);
  f.mark("early", "swimmer-1");
  assert.match(await error({}), /attendance recorded/);
  assert.equal(f.merges().length, 0); assert.equal(f.audits.length, 0);
});

test("cancelled classes, chains and hosts cannot be merged", async () => {
  const f = fixture();
  f.cancel("late");
  assert.match((await f.actions.mergeClassSession(input) as { error: string }).error, /cancelled/);
  const g = fixture();
  assert.ok((await g.actions.mergeClassSession(input)).ok);
  // Nothing can join a class that left, and the host cannot itself be merged away.
  assert.match((await g.actions.mergeClassSession({ ...input, fromCourseId: "third", intoCourseId: "early" }) as { error: string }).error, /itself been merged/);
  assert.match((await g.actions.mergeClassSession({ ...input, fromCourseId: "late", intoCourseId: "third" }) as { error: string }).error, /Other classes have joined/);
});

test("undo puts the class back only before its swimmers are marked, and audits it", async () => {
  const f = fixture();
  assert.ok((await f.actions.mergeClassSession(input)).ok);
  const id = f.merges()[0].id;
  f.mark("early", "swimmer-2");
  assert.match((await f.actions.undoClassMerge({ mergeId: id }) as { error: string }).error, /already been taken/);
  assert.equal(f.merges().length, 1);
  const g = fixture();
  assert.ok((await g.actions.mergeClassSession(input)).ok);
  assert.ok((await g.actions.undoClassMerge({ mergeId: g.merges()[0].id })).ok);
  assert.equal(g.merges().length, 0); assert.deepEqual(g.audits.map(a => a.action), ["merge-session", "unmerge-session"]);
  assert.ok((await g.actions.undoClassMerge({ mergeId: "merge-1" })).ok, "a retry after the undo lands once");
});

test("an audit failure rolls the merge back", async () => {
  const f = fixture();
  f.failAudit();
  await assert.rejects(f.actions.mergeClassSession(input));
  assert.equal(f.merges().length, 0);
});
