import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { instructorAttendanceQuery } from "./attendance-query";

test("weekly attendance SQL respects sites, dates, rosters, saved records, cover and cancellations", async () => {
  const db = new PGlite();
  const now = new Date("2026-09-17T12:00:00Z");
  const query = async (site: string) => {
    const sql = instructorAttendanceQuery(site, "2026-09-14", "2026-09-20", now);
    return (await db.query<Record<string, unknown>>(sql.text, sql.values)).rows;
  };
  try {
    await db.exec(`
      CREATE TABLE "Course" (id text PRIMARY KEY, "clubId" text, "levelId" text, name text, "dayOfWeek" text, "startMinutes" integer, "durationMinutes" integer, "instructorId" text, location text, "createdAt" timestamp, "archivedAt" timestamp);
      CREATE TABLE "Level" (id text PRIMARY KEY, name text);
      CREATE TABLE "User" (id text PRIMARY KEY, name text);
      CREATE TABLE "ClassCover" (id text PRIMARY KEY, "courseId" text, date date, "coverById" text, "coverByName" text, "instructorName" text);
      CREATE TABLE "ClassCancellation" (id text PRIMARY KEY, "courseId" text, date date);
      CREATE TABLE "Enrolment" (id text PRIMARY KEY, "courseId" text, "studentId" text, status text, "startedOn" date, "endedOn" date, "scheduledEndOn" date);
      CREATE TABLE "AttendanceRecord" (id text PRIMARY KEY, "courseId" text, "studentId" text, date date, status text, "markedByName" text, "markedAt" timestamp);
      CREATE TABLE "AuditLog" (id text PRIMARY KEY, entity text, "entityId" text, action text, "createdAt" timestamp);
      INSERT INTO "Level" VALUES ('level','Example level');
      INSERT INTO "User" VALUES ('teacher','Teacher Example');
      INSERT INTO "Course" VALUES
        ('mon','site-a','level',null,'MONDAY',600,30,'teacher','Lane 1','2026-09-01',null),
        ('cancelled','site-a','level','Cancelled example','TUESDAY',600,30,'teacher',null,'2026-09-01',null),
        ('empty','site-a','level',null,'WEDNESDAY',600,30,null,null,'2026-09-01',null),
        ('upcoming','site-a','level',null,'SUNDAY',600,30,'teacher',null,'2026-09-01',null),
        ('other','site-b','level',null,'MONDAY',600,30,'teacher',null,'2026-09-01',null),
        ('too-new','site-a','level',null,'MONDAY',600,30,'teacher',null,'2026-09-15',null),
        ('archived-before','site-a','level',null,'MONDAY',600,30,'teacher',null,'2026-09-01','2026-09-13'),
        ('archived-after','site-a','level',null,'MONDAY',600,30,'teacher',null,'2026-09-01','2026-09-15');
      INSERT INTO "ClassCover" VALUES ('cover','mon','2026-09-14',null,'Former Cover Example','Teacher Example');
      INSERT INTO "ClassCancellation" VALUES ('cancel','cancelled','2026-09-15');
      INSERT INTO "Enrolment" VALUES
        ('e1','mon','one','ACTIVE','2026-09-01',null,null),
        ('duplicate','mon','one','ACTIVE','2026-09-01',null,null),
        ('e2','mon','two','WITHDRAWN','2026-09-01','2026-09-16',null),
        ('e3','mon','three','ACTIVE','2026-09-01',null,null),
        ('future','mon','future','ACTIVE','2026-09-15',null,null),
        ('ended','mon','ended','WITHDRAWN','2026-09-01','2026-09-14',null),
        ('scheduled','mon','scheduled','ACTIVE','2026-09-01',null,'2026-09-14'),
        ('wait','mon','wait','WAITLISTED','2026-09-01',null,null),
        ('withdrawn-wait','mon','never-enrolled','WITHDRAWN','2026-09-01','2026-09-16',null),
        ('promoted','mon','promoted','ACTIVE','2026-09-01',null,null);
      INSERT INTO "AuditLog" VALUES
        ('w','Enrolment','withdrawn-wait','waitlist','2026-09-01'),
        ('p1','Enrolment','promoted','waitlist','2026-09-01'),
        ('p2','Enrolment','promoted','enrol','2026-09-02');
      INSERT INTO "AttendanceRecord" VALUES
        ('a1','mon','one','2026-09-14','ABSENT','Teacher Example','2026-09-14 10:00:00'),
        ('a2','mon','two','2026-09-14','PRESENT','Helper Example','2026-09-14 10:05:00'),
        ('a3','mon','moved-away','2026-09-14','LATE','Teacher Example','2026-09-14 10:00:00'),
        ('old','mon','one','2026-09-07','PRESENT','Other week','2026-09-07 10:00:00'),
        ('later','mon','three','2026-09-14','PRESENT','Future save','2026-09-17 12:00:01');
    `);
    const rows = await query("site-a");
    assert.equal(rows.length, 5);
    assert(!rows.some(row => row.courseId === "too-new" || row.courseId === "archived-before" || row.courseId === "other"));
    const mon = rows.find(row => row.courseId === "mon")!;
    assert.equal(mon.date, "2026-09-14");
    assert.equal(mon.className, "Example level");
    assert.equal(mon.instructorId, null);
    assert.equal(mon.instructorName, "Former Cover Example");
    assert.equal(mon.scheduledName, "Teacher Example");
    assert.equal(mon.started, true);
    assert.equal(mon.expected, 5); // four eligible roster members plus one retained saved record.
    assert.equal(mon.marked, 3);
    assert.equal(mon.present, 1); assert.equal(mon.absent, 1); assert.equal(mon.late, 1);
    assert.deepEqual(mon.savedBy, ["Helper Example", "Teacher Example"]);
    assert.equal(rows.find(row => row.courseId === "cancelled")?.cancelled, true);
    assert.equal(rows.find(row => row.courseId === "upcoming")?.date, "2026-09-20");
    assert.equal(rows.find(row => row.courseId === "empty")?.expected, 0);
    assert.equal(rows.find(row => row.courseId === "empty")?.instructorName, "Unassigned");
    assert.equal((await query("site-b")).length, 1);
    assert.deepEqual(await query("site-a' OR true --"), []);
    assert.equal(JSON.stringify(rows).includes('studentId'), false);
  } finally { await db.close(); }
});
