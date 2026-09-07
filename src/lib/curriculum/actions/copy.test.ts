import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("copying a programme includes its artwork and level artwork in the audited transaction", async () => {
  const source = { id: "source", name: "Sample", description: null, clubId: "source-club", club: { name: "Source club" },
    imageData: new Uint8Array([1]), imageVersion: "programme-version", assessmentTypes: [],
    levels: [{ name: "Level", description: null, sortOrder: 0, imageData: new Uint8Array([2]), imageVersion: "level-version", competencies: [] }] };
  let created: typeof source & { levels: { create: typeof source.levels } };
  let audited = false;
  const tx = { programme: { create: async (args: { data: typeof created }) => { created = args.data; return { id: "copy", name: "Sample" }; } } };
  const action = serverModule<typeof import("./copy")>("src/lib/curriculum/actions/copy.ts", {
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "source-club" },
    "@/lib/prisma": { prisma: { programme: { findUnique: async () => source, findFirst: async () => null },
      club: { findFirst: async () => ({ id: "target-club", name: "Target club" }) },
      $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } },
    "@/lib/audit": { logAudit: async (entry: { clubId: string }, client: unknown) => { assert.equal(entry.clubId, "target-club"); assert.equal(client, tx); audited = true; } },
    "next/cache": { revalidatePath: () => {} },
  });
  assert.equal((await action.copyProgramme("source", "target-club")).ok, true);
  assert.deepEqual(created!.imageData, source.imageData);
  assert.equal(created!.imageVersion, source.imageVersion);
  assert.deepEqual(created!.levels.create[0].imageData, source.levels[0].imageData);
  assert.equal(created!.levels.create[0].imageVersion, source.levels[0].imageVersion);
  assert.equal(audited, true);
});
