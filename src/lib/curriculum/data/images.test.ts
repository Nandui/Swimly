import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("level artwork wins, missing level artwork falls back to its programme, and absent artwork stays absent", async () => {
  let query: unknown;
  const data = serverModule<typeof import("./images")>("src/lib/curriculum/data/images.ts", {
    "@/lib/authz": { requireSession: async () => ({}) },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/prisma": { prisma: { programme: { findMany: async (args: unknown) => {
      query = args;
      return [{ id: "programme", imageVersion: "p", levels: [{ id: "own", imageVersion: "l" }, { id: "fallback", imageVersion: null }] },
        { id: "empty", imageVersion: null, levels: [{ id: "empty-level", imageVersion: null }] }];
    } } } },
  });
  const images = await data.getCurriculumImages();
  assert.equal(images.get("level:own"), "/api/curriculum-images/level/own?v=l");
  assert.equal(images.get("level:fallback"), images.get("programme:programme"));
  assert.equal(images.has("level:empty-level"), false);
  assert.ok(JSON.stringify(query).includes('"clubId":"club"'));
  assert.equal(JSON.stringify(query).includes("imageData"), false);
});
