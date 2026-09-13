import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import type { RoleInput } from "./roles";

function fixture() {
  let role = { id: "role", name: "Synthetic team", description: null as string | null, home: "overview", permissions: ["staff.manage"], screens: ["staff"] };
  const audits: string[] = [];
  let refusal: string | null = null;
  let auditFailure = false;
  let writes = 0;
  const tx = {
    staffRole: {
      findUnique: async () => role,
      findFirst: async () => null,
      create: async ({ data }: { data: Omit<typeof role, "id"> }) => { writes++; role = { id: "role", ...data }; return role; },
      update: async ({ data }: { data: Omit<typeof role, "id"> }) => { writes++; role = { ...role, ...data }; return role; },
    },
    user: { updateMany: async () => ({ count: 1 }) },
  };
  async function transaction(run: (db: typeof tx) => Promise<unknown>) {
    const before = structuredClone(role);
    try { return await run(tx); } catch (error) { role = before; throw error; }
  }
  const actions = serverModule<typeof import("./roles")>("src/lib/staff/actions/roles.ts", {
    "@/lib/prisma": { prisma: { ...tx, $transaction: transaction } },
    "@/lib/authz": { requirePermission: async (permission: string) => { assert.equal(permission, "roles.manage"); return { user: { id: "actor", name: "Synthetic Manager" } }; } },
    "@/lib/staff/keyholders": { withKeyholderLock: transaction, guardKeyholders: async () => refusal },
    "@/lib/audit": { logAudit: async ({ summary }: { summary: string }, db: unknown) => { assert.equal(db, tx); if (auditFailure) throw new Error("Audit unavailable"); audits.push(summary); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, role: () => role, audits, writes: () => writes, refuse: () => { refusal = "Keep a keyholder."; }, failAudit: () => { auditFailure = true; } };
}

const administrator: RoleInput = { name: "Synthetic team", description: "", home: "duty", permissions: ["staff.manage", "roles.manage"], screens: [] };

test("administrator roles can be created with inherited screens and an explicit full-access audit", async () => {
  const f = fixture();
  assert.equal((await f.actions.createRole(administrator)).ok, true);
  assert.deepEqual(f.role().permissions, administrator.permissions);
  assert.deepEqual(f.role().screens, []);
  assert.match(f.audits[0], /administrator access/);
});

test("limited roles still require an explicit screen on creation and update", async () => {
  const f = fixture();
  const input = { ...administrator, permissions: ["staff.manage"] };
  assert.equal((await f.actions.createRole(input)).ok, false);
  assert.equal((await f.actions.updateRole("role", input)).ok, false);
  assert.equal(f.writes(), 0);
});

test("administrator transitions are audited, while a no-change retry writes nothing", async () => {
  const f = fixture();
  assert.equal((await f.actions.updateRole("role", administrator)).ok, true);
  assert.match(f.audits[0], /administrator access granted/);
  assert.equal((await f.actions.updateRole("role", administrator)).ok, true);
  assert.equal(f.writes(), 1);
  assert.equal((await f.actions.updateRole("role", { ...administrator, permissions: ["staff.manage"], screens: ["staff"] })).ok, true);
  assert.match(f.audits[1], /administrator access removed/);
});

test("administrator updates preserve the keyholder guard and atomic audit", async () => {
  const f = fixture();
  f.refuse();
  assert.equal((await f.actions.updateRole("role", administrator)).ok, false);
  assert.equal(f.writes(), 0);
  const g = fixture();
  g.failAudit();
  await assert.rejects(g.actions.updateRole("role", administrator), /Audit unavailable/);
  assert.deepEqual(g.role().permissions, ["staff.manage"]);
});
