import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

function fixture() {
  let hash = "original-hash";
  let race = false;
  let auditFailure = false;
  let audits = 0;
  const tx = {
    user: {
      findUnique: async () => ({ id: "staff", name: "Test Staff", email: "staff@example.test", passwordHash: hash }),
      updateMany: async ({ where, data }: { where: { passwordHash: string }; data: { passwordHash: string } }) => {
        if (where.passwordHash !== hash) return { count: 0 };
        hash = data.passwordHash; return { count: 1 };
      },
    },
    auditLog: { create: async () => { if (auditFailure) throw new Error("Audit unavailable"); audits++; } },
  };
  const prisma = { ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
    if (race) hash = "reset-by-staff";
    const before = hash;
    try { return await run(tx); } catch (error) { hash = before; throw error; }
  } };
  const actions = serverModule<typeof import("./account")>("src/lib/staff/actions/account.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requireSession: async () => ({ user: { id: "staff" } }) },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
    "bcryptjs": { compare: async (value: string) => value === "current secret", hash: async () => "new-hash" },
  });
  return { actions, hash: () => hash, audits: () => audits,
    race: () => { race = true; }, failAudit: () => { auditFailure = true; },
  };
}
const input = { current: "current secret", next: "new secure secret", confirm: "new secure secret" };

test("a password change cannot overwrite a concurrent staff reset", async () => {
  const f = fixture(); f.race();
  assert.equal((await f.actions.changeOwnPassword(input)).ok, false);
  assert.equal(f.hash(), "reset-by-staff"); assert.equal(f.audits(), 0);
});

test("a failed password audit rolls back the password change", async () => {
  const f = fixture(); f.failAudit();
  await assert.rejects(f.actions.changeOwnPassword(input), /Audit unavailable/);
  assert.equal(f.hash(), "original-hash");
});
