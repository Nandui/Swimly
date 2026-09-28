import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { schedulePlacesQuery } from "./queries";

test("availability follows starts, ends and scheduled ends without counting waitlist-only withdrawals", async () => {
  const db = new PGlite();
  const count = async (date: string, site = "site-a") => {
    const query = schedulePlacesQuery(site, date);
    return (await db.query(query.text, query.values)).rows;
  };
  try {
    await db.exec(`
      CREATE TABLE "Course" (id text PRIMARY KEY, "clubId" text, "archivedAt" timestamp);
      CREATE TABLE "Enrolment" (id text PRIMARY KEY, "courseId" text, status text, "startedOn" date, "endedOn" date, "scheduledEndOn" date);
      CREATE TABLE "AuditLog" (entity text, "entityId" text, action text, "createdAt" timestamp);
      INSERT INTO "Course" VALUES ('class','site-a',null),('other','site-b',null),('old','site-a','2026-09-01');
      INSERT INTO "Enrolment" VALUES
        ('current','class','ACTIVE','2026-09-01',null,null),
        ('future','class','ACTIVE','2026-09-16',null,null),
        ('scheduled','class','ACTIVE','2026-09-01',null,'2026-09-16'),
        ('ended','class','WITHDRAWN','2026-09-01','2026-09-16',null),
        ('wait','class','WAITLISTED','2026-09-01',null,null),
        ('withdrawn-wait','class','WITHDRAWN','2026-09-01','2026-09-16',null),
        ('promoted','class','ACTIVE','2026-09-16',null,null),
        ('elsewhere','other','ACTIVE','2026-09-01',null,null),
        ('archived','old','ACTIVE','2026-09-01',null,null);
      INSERT INTO "AuditLog" VALUES
        ('Enrolment','withdrawn-wait','waitlist','2026-09-01'),
        ('Enrolment','promoted','waitlist','2026-09-01'),
        ('Enrolment','promoted','enrol','2026-09-16');
    `);
    assert.deepEqual(await count("2026-09-15"), [{ courseId: "class", enrolled: 3 }]);
    assert.deepEqual(await count("2026-09-16"), [{ courseId: "class", enrolled: 3 }]);
    assert.deepEqual(await count("2026-08-31"), []);
    assert.deepEqual(await count("2026-09-16", "site-b"), [{ courseId: "other", enrolled: 1 }]);
    assert.deepEqual(await count("2026-09-16", "site-a' OR true --"), []);
    await db.exec(`UPDATE "Enrolment" SET status='TRANSFERRED', "endedOn"='2026-09-17' WHERE id='current'`);
    assert.deepEqual(await count("2026-09-16"), [{ courseId: "class", enrolled: 3 }]);
    assert.deepEqual(await count("2026-09-17"), [{ courseId: "class", enrolled: 2 }]);
  } finally { await db.close(); }
});
