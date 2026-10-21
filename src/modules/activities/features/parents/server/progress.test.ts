import assert from "node:assert/strict";
import test from "node:test";
import { directoryDouble } from "@/test/directory-double";
import { serverModule } from "@/test/server-module";
import { curriculumProgramme } from "@/test/curriculum";

test("an unmarked skill in the child's current level reaches parents as Practising, other levels stay Not assessed", async () => {
  const events = [{ id: BigInt(1), kind: "assessment", subjectId: "booking", value: { levelId: "next", assessedOn: "2026-09-01" }, recordedAt: new Date("2026-09-01") }];
  const tx = {
    $queryRaw: async () => events,
    programme: { findMany: async () => [curriculumProgramme()] },
    enrolment: { findMany: async () => [{ levelId: "entry" }] },
  };
  const { childProgress } = serverModule<typeof import("@/modules/activities/features/parents/server/progress")>("src/modules/activities/features/parents/server/progress.ts", {
    "@/lib/directory": directoryDouble(),
    "@/lib/prisma": { prisma: tx },
    "@/modules/activities/shared/parents/children": { requireChild: async () => ({}) },
  });
  const progress = await childProgress(tx as never, {} as never, "child");
  const levels = progress.programmes[0].levels;
  const entry = levels.find(l => l.id === "entry")!, next = levels.find(l => l.id === "next")!;
  assert.equal(entry.competencies[0].status, "WORKING_ON");
  assert.equal(entry.achieved, 0);
  assert.equal(next.competencies[0].status, "NOT_ASSESSED");
});
