import assert from "node:assert/strict";
import { test } from "node:test";
import { latestSharedMarks, sharedIds } from "./shared";
import { sharedCurriculumRows } from "@/test/curriculum";
import { serverModule } from "@/test/server-module";

test("explicit curriculum links survive renames and keep unrelated definitions separate", () => {
  const links = sharedIds([{ id: "original", sharedWithId: null }, { id: "copy", sharedWithId: "original" }, { id: "another", sharedWithId: null }]);
  assert.equal(links.resolve("copy"), "original");
  assert.deepEqual(links.variants("copy"), ["original", "copy"]);
  assert.equal(links.resolve("another"), "another");
  assert.throws(() => sharedIds([{ id: "a", sharedWithId: "b" }]), /missing/);
  assert.throws(() => sharedIds([{ id: "a", sharedWithId: "b" }, { id: "b", sharedWithId: "a" }]), /circular/);
});

test("the last recorded shared judgement wins, including a later correction on the same day", () => {
  const older = { competencyId: "original", assessedOn: new Date("2026-09-01"), updatedAt: new Date("2026-09-01T10:00:00Z"), status: "ACHIEVED", assessedByName: "Assessor A" };
  const correction = { ...older, competencyId: "copy", updatedAt: new Date("2026-09-01T11:00:00Z"), status: "WORKING_ON", assessedByName: "Assessor B" };
  assert.deepEqual(latestSharedMarks([correction, older], () => "original"), [{ ...correction, competencyId: "original" }]);
});

test("the shared catalogue includes unique children from site copies and aggregates historical counts", async () => {
  const rows = sharedCurriculumRows();
  rows[0].name = "Renamed shared programme";
  rows[1].levels[0]._count.courses = 3;
  rows[1].levels[0].competencies.push({ ...rows[1].levels[0].competencies[0], id: "unique-skill", name: "Glide", sharedWithId: null });
  const data = serverModule<typeof import("./data/shared")>("src/lib/curriculum/data/shared.ts", {
    "@/lib/prisma": { prisma: { programme: { findMany: async () => rows } } },
  });
  const catalogue = await data.readSharedCurriculum();
  assert.equal(catalogue.programmes.length, 1);
  assert.equal(catalogue.level("entry-b")?.programme.name, "Renamed shared programme");
  assert.equal(catalogue.level("entry")?._count.courses, 3);
  assert.deepEqual(catalogue.level("entry")?.competencies.map(c => c.name).sort(), ["Float", "Glide"]);
  assert.equal(catalogue.types.length, 1);
  rows[0].levels[0].archivedAt = new Date();
  assert.equal(data.liveSharedLevel(await data.readSharedCurriculum(), "entry-b"), null, "the shared archive state applies to old site IDs");
});
