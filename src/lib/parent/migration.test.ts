import assert from "node:assert/strict";
import { test } from "node:test";
import { isolatedPrisma } from "../../test/pglite-prisma";

test("migration backfills existing progress without changing staff records; note edits and rollbacks cannot publish progress", async () => {
  const fixture = await isolatedPrisma(async db => {
    await db.exec(`
      INSERT INTO "Programme" (id,"clubId",name,"updatedAt") VALUES ('programme','club_bishopstown','Synthetic programme',now());
      INSERT INTO "Level" (id,"programmeId",name,"updatedAt") VALUES ('level','programme','Synthetic level',now());
      INSERT INTO "Competency" (id,"levelId",name,"updatedAt") VALUES ('skill','level','Synthetic skill',now());
      INSERT INTO "Student" (id,"clubId","firstName","lastName","updatedAt") VALUES ('child','club_bishopstown','Synthetic','Swimmer',now());
      INSERT INTO "CompetencyResult" (id,"studentId","competencyId",status,"assessedByName","assessedOn",note,"updatedAt")
        VALUES ('mark','child','skill','ACHIEVED','Synthetic teacher','2026-09-10','private','2026-09-14 10:00:00');
      INSERT INTO "LevelCompletion" (id,"studentId","levelId","programmeId","completedOn","competenciesAchieved","competencyCount","confirmedByName","updatedAt")
        VALUES ('completion','child','level','programme','2026-09-10',1,1,'Synthetic teacher','2026-09-14 10:00:00');
    `);
  });
  try {
    const { prisma } = fixture;
    const events = await prisma.parentProgressEvent.findMany({ orderBy: { id: "asc" } });
    assert.equal(events.length, 2);
    assert.equal(events[0].releaseAt.toISOString(), "2026-09-14T23:00:00.000Z");
    assert.equal((await prisma.competencyResult.findUniqueOrThrow({ where: { id: "mark" } })).note, "private");
    await prisma.competencyResult.update({ where: { id: "mark" }, data: { note: "still private" } });
    assert.equal(await prisma.parentProgressEvent.count(), 2, "Note-only changes do not reset publication");
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.competencyResult.update({ where: { id: "mark" }, data: { status: "WORKING_ON" } });
      throw new Error("Synthetic rollback");
    }), /Synthetic rollback/);
    assert.equal(await prisma.parentProgressEvent.count(), 2);
    assert.equal((await prisma.competencyResult.findUniqueOrThrow({ where: { id: "mark" } })).status, "ACHIEVED");
    await prisma.levelCompletion.delete({ where: { id: "completion" } });
    const clearing = await prisma.parentProgressEvent.findFirstOrThrow({ where: { kind: "completion" }, orderBy: { id: "desc" } });
    assert.equal(clearing.value, null);
    assert.equal(await prisma.parentChildAccess.count(), 0, "Migration cannot grant guardian access from contacts");
    assert.equal(await prisma.parentAccount.count(), 0);
  } finally { await fixture.close(); }
});
