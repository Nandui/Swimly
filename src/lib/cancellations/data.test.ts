import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

test("billing roster reads require the screen and stay bounded to the selected site", async () => {
  let allowed = false;
  const reads: unknown[] = [];
  const data = serverModule<typeof import("./data")>("src/lib/cancellations/data.ts", {
    "@/lib/authz": { requireSession: async () => ({ user: { id: "staff" } }), canSee: () => allowed, AuthorizationError: Error },
    "@/lib/clubs/current": { currentClubId: async () => "site" },
    "@/lib/prisma": { prisma: { classCancellation: {
      count: async (args: { where: { clubId: string } }) => { reads.push(args); assert.equal(args.where.clubId, "site"); return 26; },
      findMany: async (args: { where: { clubId: string; billingNotifiedAt: unknown }; skip: number; take: number }) => {
        reads.push(args); assert.equal(args.where.clubId, "site"); assert.deepEqual(args.where.billingNotifiedAt, { not: null });
        assert.equal(args.skip, 25); assert.equal(args.take, 25); return [];
      },
    } } },
  });
  await assert.rejects(data.getBillingCancellations(false, 1), /access/);
  assert.deepEqual(reads, []);
  allowed = true;
  const result = await data.getBillingCancellations(true, 1000000);
  assert.equal(result.page, 2); assert.equal(result.pages, 2); assert.equal(result.total, 26);
});
