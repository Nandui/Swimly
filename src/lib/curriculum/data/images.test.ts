import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { curriculumProgramme } from "@/test/curriculum";

test("shared artwork resolves original IDs, falls back to its programme, and never loads bytes in page props", async () => {
  let query: unknown;
  const programme = curriculumProgramme("programme", ["own", "fallback"]);
  programme.imageVersion = "p"; programme.levels[0].imageVersion = "l";
  const empty = curriculumProgramme("empty", ["empty-level"]);
  const alias = curriculumProgramme("copy", ["copy-own"]);
  alias.sharedWithId = "programme"; alias.levels[0].sharedWithId = "own";
  const data = serverModule<typeof import("./images")>("src/lib/curriculum/data/images.ts", {
    "@/lib/authz": { requireSession: async () => ({}) },
    "@/lib/prisma": { prisma: { programme: { findMany: async (args: unknown) => { query = args; return [programme, empty, alias]; } } } },
  });
  const images = await data.getCurriculumImages();
  assert.equal(images.get("level:own"), "/api/curriculum-images/level/own?v=l");
  assert.equal(images.get("level:copy-own"), images.get("level:own"));
  assert.equal(images.get("level:fallback"), images.get("programme:programme"));
  assert.equal(images.has("level:empty-level"), false);
  assert.equal(JSON.stringify(query).includes('"clubId":"club"'), false);
  assert.equal(JSON.stringify(query).includes("imageData"), false);
});
