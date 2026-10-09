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

test("the classes in Done when the restore stage arrived move to To restore; awaiting and restored ones stay", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Course" (id TEXT PRIMARY KEY); CREATE TABLE "Student" (id TEXT PRIMARY KEY); INSERT INTO "Course" VALUES (\'a\'),(\'b\'),(\'c\');');
    await db.exec(readFileSync("prisma/migrations/20260913120000_class_cancellations/migration.sql", "utf8"));
    await db.exec(readFileSync("prisma/migrations/20261027120000_cancellation_restore/migration.sql", "utf8"));
    const insert = `INSERT INTO "ClassCancellation" (id,"courseId","clubId",date,"className","levelName","programmeName","startMinutes","durationMinutes",reason,"cancelledById","cancelledByName","billingNotifiedAt","billingNotifiedByName","restoredAt")
      VALUES ($1,$1,'site','2026-09-13','Turtles','Turtles','Swimming Skills',900,30,'Pool closed','manager','Manager',$2,$3,$4)`;
    await db.query(insert, ["a", "2026-10-01T10:00:00Z", "Synthetic Biller", null]);
    await db.query(insert, ["b", null, null, null]);
    await db.query(insert, ["c", "2026-10-01T10:00:00Z", "Synthetic Biller", "2026-10-05T10:00:00Z"]);
    await db.exec(readFileSync("prisma/migrations/20261028120000_cancellations_done_to_restore/migration.sql", "utf8"));
    const rows = (await db.query<{ id: string; legendProcessedAt: Date | null; billingNotifiedAt: Date | null; legendProcessedByName: string | null }>('SELECT id, "legendProcessedAt", "billingNotifiedAt", "legendProcessedByName" FROM "ClassCancellation" ORDER BY id')).rows;
    assert.ok(rows[0].legendProcessedAt, "done before: now to restore");
    assert.equal(rows[0].legendProcessedAt?.getTime(), rows[0].billingNotifiedAt?.getTime(), "as of when billing was notified");
    assert.equal(rows[0].legendProcessedByName, "Synthetic Biller");
    assert.equal(rows[1].legendProcessedAt, null, "still awaiting billing");
    assert.equal(rows[2].legendProcessedAt, null, "already restored stays done");
  } finally { await db.close(); }
});
