import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

/** Real PostgreSQL migration semantics in an ephemeral, synthetic database.
 * This test never reads environment variables or opens a network connection. */
test("shared-curriculum migration links matching definitions and preserves all swimmer history", async () => {
  const db = await PGlite.create();
  try {
    const directory = "prisma/migrations";
    const migration = "20260911000000_shared_swimmers_curriculum";
    for (const folder of readdirSync(directory).filter(f => /^\d/.test(f)).sort()) {
      if (folder === migration) break;
      await db.exec(readFileSync(`${directory}/${folder}/migration.sql`, "utf8"));
    }
    await db.exec(`
      INSERT INTO "Programme" (id, name, "clubId", "updatedAt") VALUES
        ('p-a', 'Learn to Swim', 'club_bishopstown', now()),
        ('p-b', 'learn to swim', 'club_churchfield', now()),
        ('p-distinct', 'Squad', 'club_churchfield', now());
      INSERT INTO "Level" (id, name, "programmeId", "updatedAt") VALUES
        ('l-a', 'Entry', 'p-a', now()), ('l-b', ' Entry ', 'p-b', now()),
        ('l-other', 'Entry', 'p-distinct', now()), ('l-extra', 'Next', 'p-b', now());
      INSERT INTO "Competency" (id, name, "levelId", "updatedAt") VALUES
        ('c-a', 'Float', 'l-a', now()), ('c-b', 'float', 'l-b', now()), ('c-other', 'Float', 'l-other', now());
      INSERT INTO "AssessmentType" (id, name, "programmeId", "updatedAt") VALUES
        ('t-a', 'Placement', 'p-a', now()), ('t-b', 'Placement', 'p-b', now());
      INSERT INTO "Student" (id, "firstName", "lastName", "clubId", "updatedAt") VALUES
        ('s-a', 'Synthetic', 'Swimmer', 'club_bishopstown', now()),
        ('s-b', 'Synthetic', 'Swimmer', 'club_churchfield', now());
      INSERT INTO "Course" (id, "levelId", "clubId", "dayOfWeek", "startMinutes", "durationMinutes", "updatedAt") VALUES
        ('class-a', 'l-a', 'club_bishopstown', 'MONDAY', 900, 30, now()),
        ('class-b', 'l-b', 'club_churchfield', 'MONDAY', 900, 30, now());
      INSERT INTO "Enrolment" (id, "studentId", "courseId", "levelId", "programmeId", "startedOn", "updatedAt") VALUES
        ('place-a', 's-a', 'class-a', 'l-a', 'p-a', '2026-09-01', now()),
        ('place-b', 's-b', 'class-b', 'l-b', 'p-b', '2026-09-01', now());
      INSERT INTO "CompetencyResult" (id, "studentId", "competencyId", status, "assessedOn", "assessedByName", "updatedAt") VALUES
        ('mark-a', 's-a', 'c-a', 'ACHIEVED', '2026-09-01', 'Assessor A', '2026-09-01'),
        ('mark-b', 's-a', 'c-b', 'WORKING_ON', '2026-09-02', 'Assessor B', '2026-09-02');
      INSERT INTO "LevelCompletion" (id, "studentId", "levelId", "programmeId", "completedOn", "competenciesAchieved", "competencyCount", "confirmedByName", "updatedAt") VALUES
        ('completion-a', 's-a', 'l-a', 'p-a', '2026-09-01', 1, 1, 'Assessor A', now()),
        ('completion-b', 's-a', 'l-b', 'p-b', '2026-09-02', 2, 3, 'Assessor B', now());
    `);
    const history = ["Student", "Course", "Enrolment", "CompetencyResult", "LevelCompletion"];
    const before = await Promise.all(history.map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`)));
    await db.exec(readFileSync(`${directory}/${migration}/migration.sql`, "utf8"));
    for (const [i, table] of history.entries()) assert.deepEqual((await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows, before[i].rows, `${table} history must not change`);
    for (const [model, copy, canonical] of [["Programme", "p-b", "p-a"], ["Level", "l-b", "l-a"], ["Competency", "c-b", "c-a"], ["AssessmentType", "t-b", "t-a"]]) {
      assert.equal((await db.query<{ sharedWithId: string }>(`SELECT "sharedWithId" FROM "${model}" WHERE id = $1`, [copy])).rows[0].sharedWithId, canonical);
    }
    assert.equal((await db.query('SELECT id FROM "Level" WHERE "sharedWithId" IS NULL')).rows.length, 3, "unique levels and different programmes remain distinct");
    assert.equal((await db.query('SELECT id FROM "AuditLog" WHERE action = $1 AND "clubId" IS NULL', ["link-shared-curriculum"])).rows.length, 4, "every link has a shared audit record");
    await assert.rejects(db.exec(`UPDATE "Level" SET "sharedWithId" = id WHERE id = 'l-a'`), /check constraint/);
    await assert.rejects(db.exec(`DELETE FROM "Programme" WHERE id = 'p-a'`), /foreign key/);
  } finally { await db.close(); }
});
