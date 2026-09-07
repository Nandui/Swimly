import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("image responses require sign-in, current-club ownership and the matching version", async () => {
  let signedIn = false;
  let row: { imageData: Uint8Array; imageVersion: string } | null = { imageData: new Uint8Array([1, 2]), imageVersion: "version" };
  const scopes: unknown[] = [];
  const model = { findUnique: async (args: { where: unknown }) => { scopes.push(args.where); return row; } };
  const route = serverModule<typeof import("@/app/api/curriculum-images/[kind]/[id]/route")>("src/app/api/curriculum-images/[kind]/[id]/route.ts", {
    "@/auth": { auth: async () => signedIn ? { user: { id: "staff" } } : null },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/prisma": { prisma: { programme: model, level: model } },
  });
  const request = (kind: string, version = "version", etag?: string) => route.GET(new Request(`https://example.test/api/curriculum-images/${kind}/id?v=${version}`, { headers: etag ? { "if-none-match": etag } : {} }), { params: Promise.resolve({ kind, id: "id" }) });
  assert.equal((await request("programme")).status, 401);
  assert.equal(scopes.length, 0);
  signedIn = true;
  for (const kind of ["programme", "level"]) {
    const response = await request(kind);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "private, no-cache");
    assert.equal((await request(kind, "version", '"version"')).status, 304);
    assert.equal((await request(kind, "old")).status, 404);
  }
  assert.deepEqual(scopes[0], { id: "id", clubId: "club" });
  assert.ok(scopes.some((scope) => JSON.stringify(scope) === JSON.stringify({ id: "id", programme: { clubId: "club" } })));
  row = null;
  assert.equal((await request("level")).status, 404);
  assert.equal((await request("unknown")).status, 404);
});
