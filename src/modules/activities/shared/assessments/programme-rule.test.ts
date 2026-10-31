import assert from "node:assert/strict";
import { test } from "node:test";
import { directoryDouble } from "@/test/directory-double";
import { curriculumProgramme } from "@/test/curriculum";
import { serverModule } from "@/test/server-module";

type Rule = typeof import("@/modules/activities/shared/assessments/programme-rule");
type Shared = typeof import("@/modules/activities/shared/curriculum/data/shared");

async function catalogue() {
  const rows = [["water", "Water Safety and Fun"], ["skills", "Swimming Skills"], ["rookie", "Rookie Lifesaving"]]
    .map(([id, name], i) => ({ ...curriculumProgramme(id, [`${id}-level`]), name, sortOrder: i }));
  const prisma = { programme: { findMany: async () => rows } };
  const shared = serverModule<Shared>("src/modules/activities/shared/curriculum/data/shared.ts", { "@/lib/prisma": { prisma },
    "@/lib/directory": directoryDouble({ sites: [{ id: "club", name: "Site A" }] }) });
  return shared.readSharedCurriculum(prisma as never);
}
const rule = serverModule<Rule>("src/modules/activities/shared/assessments/programme-rule.ts", {});

test("programmes run in order: a swimmer is assessed for their own programme or a later one", async () => {
  const c = await catalogue();
  const can = (enrolled: string[], target: string) => rule.programmeRuleError(c, enrolled, target, "Sam") === null;
  // Not in a class yet: any programme.
  assert.deepEqual(["water", "skills", "rookie"].map((t) => can([], t)), [true, true, true]);
  // In Water Safety and Fun: all three.
  assert.deepEqual(["water", "skills", "rookie"].map((t) => can(["water"], t)), [true, true, true]);
  // In Swimming Skills: not Water Safety and Fun.
  assert.deepEqual(["water", "skills", "rookie"].map((t) => can(["skills"], t)), [false, true, true]);
  // In Rookie Lifesaving: Rookie only.
  assert.deepEqual(["water", "skills", "rookie"].map((t) => can(["rookie"], t)), [false, false, true]);
  // Places in two programmes: the later one counts.
  assert.equal(can(["water", "skills"], "water"), false);
  assert.equal(rule.programmeRuleError(c, ["skills"], "water", "Sam"),
    "Sam is already in Swimming Skills, so they can only book an assessment for Swimming Skills or Rookie Lifesaving.");
});
