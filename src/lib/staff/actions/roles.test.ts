import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { UNRESTRICTED_PERMISSIONS } from "@/lib/staff/permissions";
import type { RoleInput } from "./roles";

type Row = { id: string; name: string; description: string | null; home: string; homeName: string | null; permissions: string[]; screens: string[]; levels: unknown; extras: string[]; restricted: boolean };

function fixture(options: { superadmin?: boolean } = {}) {
  let role: Row = { id: "role", name: "Synthetic team", description: null, home: "overview", homeName: null, permissions: ["staff.manage"], screens: ["staff"], levels: null, extras: [], restricted: false };
  const audits: string[] = [];
  let refusal: string | null = null;
  let auditFailure = false;
  let writes = 0;
  const tx = {
    staffRole: {
      findUnique: async () => role,
      findFirst: async () => null,
      create: async ({ data }: { data: Omit<Row, "id"> }) => { writes++; role = { id: "role", ...data }; return role; },
      update: async ({ data }: { data: Partial<Row> }) => { writes++; role = { ...role, ...data }; return role; },
    },
    user: { updateMany: async () => ({ count: 1 }) },
  };
  async function transaction(run: (db: typeof tx) => Promise<unknown>) {
    const before = structuredClone(role);
    try { return await run(tx); } catch (error) { role = before; throw error; }
  }
  const actions = serverModule<typeof import("./roles")>("src/lib/staff/actions/roles.ts", {
    "@/lib/prisma": { prisma: { ...tx, $transaction: transaction } },
    "@/lib/authz": { requirePermission: async (permission: string) => { assert.equal(permission, "roles.manage"); return { user: { id: "actor", name: "Synthetic Manager", isSuperadmin: options.superadmin === true } }; } },
    "@/lib/staff/keyholders": { withKeyholderLock: transaction, guardKeyholders: async () => refusal },
    "@/lib/audit": { logAudit: async ({ summary }: { summary: string }, db: unknown) => { assert.equal(db, tx); if (auditFailure) throw new Error("Audit unavailable"); audits.push(summary); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, role: () => role, audits, writes: () => writes, refuse: () => { refusal = "Keep a keyholder."; }, failAudit: () => { auditFailure = true; } };
}

const administrator: RoleInput = { name: "Synthetic team", description: "", homeName: "Management", levels: { admin: "manage" }, extras: [] };
const receptionist: RoleInput = { name: "Synthetic desk", description: "", homeName: "Front of House", levels: { "swim-school": "desk", refunds: "use", docs: "read" }, extras: [] };

test("a role is saved as levels, with their translation in the permission and screen columns", async () => {
  const f = fixture();
  assert.equal((await f.actions.createRole(receptionist)).ok, true);
  assert.deepEqual(f.role().levels, receptionist.levels);
  assert.equal(f.role().homeName, "Front of House");
  assert.ok(f.role().permissions.includes("enrolment.manage") && f.role().permissions.includes("refunds.request"));
  assert.ok(f.role().screens.includes("refunds") && !f.role().screens.includes("staff"));
  assert.equal(f.role().home, "calendar");
  assert.equal(f.audits[0], "Created role Synthetic desk: Swim school: Desk · Refunds: Use · Docs: Read");
});

test("Admin Manage stores today's administrator access", async () => {
  const f = fixture();
  assert.equal((await f.actions.createRole(administrator)).ok, true);
  assert.deepEqual(f.role().permissions, [...UNRESTRICTED_PERMISSIONS].sort());
});

test("a role needs at least one module, on creation and update", async () => {
  const f = fixture();
  const input = { ...administrator, levels: {} };
  assert.equal((await f.actions.createRole(input)).ok, false);
  assert.equal((await f.actions.updateRole("role", input)).ok, false);
  assert.equal(f.writes(), 0);
});

test("switching an old role to levels is audited, and a no-change retry writes nothing", async () => {
  const f = fixture();
  assert.equal((await f.actions.updateRole("role", administrator)).ok, true);
  assert.match(f.audits[0], /switched to levels/);
  assert.match(f.audits[0], /Admin: Manage/);
  assert.equal((await f.actions.updateRole("role", administrator)).ok, true);
  assert.equal(f.writes(), 1);
  assert.equal((await f.actions.updateRole("role", receptionist)).ok, true);
  assert.match(f.audits[1], /Admin: Manage → Swim school: Desk · Refunds: Use · Docs: Read/);
});

test("updates keep the keyholder guard and write the audit with the change", async () => {
  const f = fixture();
  f.refuse();
  assert.equal((await f.actions.updateRole("role", receptionist)).ok, false);
  assert.equal(f.writes(), 0);
  const g = fixture();
  g.failAudit();
  await assert.rejects(g.actions.updateRole("role", receptionist), /Audit unavailable/);
  assert.deepEqual(g.role().permissions, ["staff.manage"]);
});

test("only a superadmin gives HR", async () => {
  const hr: RoleInput = { ...receptionist, levels: { hr: "team" } };
  assert.equal((await fixture().actions.createRole(hr)).ok, false);
  const s = fixture({ superadmin: true });
  assert.equal((await s.actions.createRole(hr)).ok, true);
  assert.equal(s.role().restricted, true);
});
