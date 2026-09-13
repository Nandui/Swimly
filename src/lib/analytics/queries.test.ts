import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "@/generated/prisma/client";
import { currentEnrolmentsQuery, levelCapacityQuery, activityQuery, cancellationsQuery } from "./queries";

test("analytics SQL respects current places, site scope, event history and calendar windows", async t => {
  const db = new PGlite();
  const query = async (sql: Prisma.Sql) => (await db.query<Record<string, unknown>>(sql.text, sql.values)).rows;
  try {
    await db.exec(`
      CREATE TABLE "Student" (id text PRIMARY KEY, status text);
      CREATE TABLE "Course" (id text PRIMARY KEY, "clubId" text, "archivedAt" timestamp, "levelId" text, capacity integer);
      CREATE TABLE "Enrolment" (id text PRIMARY KEY, "studentId" text, "courseId" text, "levelId" text, status text, "startedOn" date, "endedOn" date, "scheduledEndOn" date);
      CREATE TABLE "AuditLog" (id text PRIMARY KEY, entity text, "entityId" text, action text, "clubId" text, "createdAt" timestamp);
      CREATE TABLE "ClassCancellation" (id text PRIMARY KEY, "clubId" text, date date, "billingNotifiedAt" timestamp);
      CREATE TABLE "CancelledClassSwimmer" (id text PRIMARY KEY, "cancellationId" text);
      INSERT INTO "Student" VALUES ('a','ACTIVE'),('b','ACTIVE'),('inactive','INACTIVE');
      INSERT INTO "Course" VALUES
        ('a','site-a',null,'level',8),('b','site-b',null,'level-copy',10),
        ('archived','site-a','2026-09-01','level',999),('empty','site-a',null,'level',12),
        ('uncapped','site-a',null,'uncapped',null),('mixed','site-a',null,'uncapped',10),
        ('zero','site-a',null,'zero',0);
      INSERT INTO "Enrolment" VALUES
        ('active','a','a','previous-placement-level','ACTIVE','2026-09-01',null,null),
        ('other','a','b','level-copy','ACTIVE','2026-09-01',null,null),
        ('future','b','a','level','ACTIVE','2026-09-14',null,null),
        ('ended','b','a','level','WITHDRAWN','2026-09-01','2026-09-12',null),
        ('scheduled','b','a','level','ACTIVE','2026-09-01',null,'2026-09-13'),
        ('wait','b','a','level','WAITLISTED','2026-09-01',null,null),
        ('inactive','inactive','a','level','ACTIVE','2026-09-01',null,null),
        ('archived','b','archived','level','ACTIVE','2026-09-01',null,null),
        ('ended-active','b','a','level','ACTIVE','2026-09-01','2026-09-13',null);
      INSERT INTO "AuditLog" VALUES
        ('before','Enrolment','early','enrol','site-a','2026-09-06 22:59:59'),
        ('midnight','Enrolment','active','enrol','site-a','2026-09-06 23:00:00'),
        ('future','Enrolment','future','enrol','site-a','2026-09-13 12:00:01'),
        ('end','Enrolment','ended','withdraw','site-a','2026-09-12 12:00:00'),
        ('schedule-end','Enrolment','scheduled','withdraw','site-a','2026-09-13 08:00:00'),
        ('moved','Enrolment','active','transfer','site-a','2026-09-12 12:00:00'),
        ('import','Course','a','enrol','site-a','2026-09-12 12:00:00'),
        ('queued','Enrolment','wait','waitlist','site-a','2026-09-01 12:00:00'),
        ('queue-end','Enrolment','wait','withdraw','site-a','2026-09-12 12:00:00'),
        ('promoted-queue','Enrolment','promoted','waitlist','site-a','2026-09-01 12:00:00'),
        ('promoted','Enrolment','promoted','enrol','site-a','2026-09-09 12:00:00'),
        ('promoted-end','Enrolment','promoted','withdraw','site-a','2026-09-12 12:00:00'),
        ('other-site','Enrolment','other','enrol','site-b','2026-09-12 12:00:00');
      INSERT INTO "ClassCancellation" VALUES ('one','site-a','2026-09-01',null),('two','site-a','2026-09-12','2026-09-12'),('other','site-b','2026-09-12',null),('old','site-a','2026-08-31',null),('next','site-a','2026-10-01',null);
      INSERT INTO "CancelledClassSwimmer" VALUES ('1','one'),('2','one'),('3','two'),('4','other');
    `);
    await t.test("current places use the class level and exclude future, ended, scheduled, waitlisted, inactive and archived records", async () => {
      assert.deepEqual(await query(currentEnrolmentsQuery(["site-a"], "2026-09-13")), [{ studentId: "a", levelId: "level" }]);
      assert.equal((await query(currentEnrolmentsQuery(["site-a", "site-b"], "2026-09-13"))).length, 2);
      assert.deepEqual(await query(currentEnrolmentsQuery(["site-a' OR true --"], "2026-09-13")), []);
    });
    await t.test("level capacity sums each live class once, including empty classes, and preserves uncapped and zero capacity", async () => {
      const rows = await query(levelCapacityQuery(["site-a"]));
      assert.deepEqual(rows.sort((a, b) => String(a.levelId).localeCompare(String(b.levelId))), [
        { levelId: "level", classes: 2, capacity: 20 },
        { levelId: "uncapped", classes: 2, capacity: null },
        { levelId: "zero", classes: 1, capacity: 0 },
      ]);
      assert.deepEqual(await query(levelCapacityQuery(["site-b"])), [{ levelId: "level-copy", classes: 1, capacity: 10 }]);
      assert.equal((await query(levelCapacityQuery(["site-a", "site-b"]))).length, 4);
      assert.deepEqual(await query(levelCapacityQuery(["site-a' OR true --"])), []);
    });
    await t.test("seven-day actions include promotions, exclude transfers, imports, waitlist removals and future timestamps", async () => {
      const rows = await query(activityQuery(["site-a"], "2026-09-07", new Date("2026-09-13T12:00:00Z")));
      assert.deepEqual(rows, [
        { day: "2026-09-07", enrolled: 1, withdrawn: 0 },
        { day: "2026-09-09", enrolled: 1, withdrawn: 0 },
        { day: "2026-09-12", enrolled: 0, withdrawn: 2 },
        { day: "2026-09-13", enrolled: 0, withdrawn: 1 },
      ]);
      const all = await query(activityQuery(["site-a", "site-b"], "2026-09-07", new Date("2026-09-13T12:00:00Z")));
      assert.deepEqual(all[2], { day: "2026-09-12", enrolled: 1, withdrawn: 2 });
    });
    await t.test("month totals count sessions without multiplying them by the affected roster", async () => {
      assert.deepEqual(await query(cancellationsQuery(["site-a"], "2026-09-01", "2026-10-01")), [{ sessions: 2, pending: 1, notified: 1, affectedPlaces: 3 }]);
      assert.deepEqual(await query(cancellationsQuery(["site-a", "site-b"], "2026-09-01", "2026-10-01")), [{ sessions: 3, pending: 2, notified: 1, affectedPlaces: 4 }]);
      assert.deepEqual(await query(cancellationsQuery(["empty"], "2026-09-01", "2026-10-01")), [{ sessions: 0, pending: 0, notified: 0, affectedPlaces: 0 }]);
    });
    await t.test("Dublin buckets respect both sides of daylight-saving changes", async () => {
      await db.exec(`INSERT INTO "AuditLog" VALUES ('spring','Enrolment','x','enrol','site-a','2026-03-29 23:30:00'),('autumn','Enrolment','y','enrol','site-a','2026-10-25 23:30:00')`);
      assert.deepEqual(await query(activityQuery(["site-a"], "2026-03-30", new Date("2026-03-30T12:00:00Z"))), [{ day: "2026-03-30", enrolled: 1, withdrawn: 0 }]);
      assert.deepEqual(await query(activityQuery(["site-a"], "2026-10-26", new Date("2026-10-26T12:00:00Z"))), []);
    });
  } finally { await db.close(); }
});
