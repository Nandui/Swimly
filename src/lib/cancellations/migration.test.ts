import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("additive cancellation migration enforces one occurrence and one roster entry without touching teaching data", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Course" (id TEXT PRIMARY KEY); CREATE TABLE "Student" (id TEXT PRIMARY KEY); INSERT INTO "Course" VALUES (\'class\'); INSERT INTO "Student" VALUES (\'swimmer\');');
    await db.exec(readFileSync("prisma/migrations/20260913120000_class_cancellations/migration.sql", "utf8"));
    const insert = `INSERT INTO "ClassCancellation" (id,"courseId","clubId",date,"className","levelName","programmeName","startMinutes","durationMinutes",reason,"cancelledById","cancelledByName") VALUES ($1,'class','site','2026-09-13','Turtles','Turtles','Swim',900,30,'Pool closed','manager','Manager')`;
    await db.query(insert, ["one"]);
    await assert.rejects(db.query(insert, ["two"]), /unique/);
    await db.exec(`INSERT INTO "CancelledClassSwimmer" (id,"cancellationId","studentId","swimmerName") VALUES ('roster','one','swimmer','Synthetic Swimmer')`);
    await assert.rejects(db.exec(`INSERT INTO "CancelledClassSwimmer" (id,"cancellationId","studentId","swimmerName") VALUES ('duplicate','one','swimmer','Synthetic Swimmer')`), /unique/);
    await assert.rejects(db.exec(`DELETE FROM "Course" WHERE id='class'`), /foreign key/);
    assert.equal((await db.query('SELECT * FROM "ClassCancellation" WHERE "billingNotifiedAt" IS NULL')).rows.length, 1);
  } finally { await db.close(); }
});
