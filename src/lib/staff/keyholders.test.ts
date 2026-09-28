import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

function fixture() {
  let userReads = 0;
  let roleReads = 0;
  const roles = [{ id: "keyholder", permissions: ["staff.manage", "roles.manage"] }];
  const prisma = {
    user: { findMany: async () => { userReads++; return [{ id: "staff", staffRoleId: "keyholder" }]; } },
    staffRole: { findMany: async () => { roleReads++; return roles; } },
  };
  const actions = serverModule<typeof import("./keyholders")>("src/lib/staff/keyholders.ts", { "@/lib/prisma": { prisma } });
  return { actions, roles, reads: () => ({ userReads, roleReads }) };
}

test("keyholder checks read users and roles once for both required permissions", async () => {
  const f = fixture();
  assert.equal(await f.actions.guardKeyholders({ kind: "rolePermissions", roleId: "keyholder", permissions: ["staff.manage", "roles.manage"] }), null);
  assert.deepEqual(f.reads(), { userReads: 1, roleReads: 1 });
});

test("removing either management key still cannot leave the app without a keyholder", async () => {
  for (const permission of ["staff.manage", "roles.manage"]) {
    const f = fixture();
    assert.notEqual(await f.actions.guardKeyholders({ kind: "rolePermissions", roleId: "keyholder", permissions: [permission] }), null);
  }
});

test("moving the last keyholder to a role without a key is counted", async () => {
  const f = fixture();
  f.roles.push({ id: "staff-only", permissions: ["staff.manage"] });
  assert.equal(await f.actions.activeHoldersOf("staff.manage", { kind: "userRole", userId: "staff", roleId: "staff-only" }), 1);
  assert.equal(await f.actions.activeHoldersOf("roles.manage", { kind: "userRole", userId: "staff", roleId: "staff-only" }), 0);
});

test("the last active keyholder cannot be deactivated", async () => {
  const f = fixture();
  assert.notEqual(await f.actions.guardKeyholders({ kind: "deactivate", userId: "staff" }), null);
});

test("the last active superadmin cannot be removed or deactivated", async () => {
  const supers = [{ id: "owner" }];
  const prisma = { user: { findMany: async () => supers }, staffRole: { findMany: async () => [] } };
  const actions = serverModule<typeof import("./keyholders")>("src/lib/staff/keyholders.ts", { "@/lib/prisma": { prisma } });
  assert.notEqual(await actions.guardSuperadmins({ kind: "superadmin", userId: "owner", value: false }), null);
  assert.notEqual(await actions.guardSuperadmins({ kind: "deactivate", userId: "owner" }), null);
  supers.push({ id: "second" });
  assert.equal(await actions.guardSuperadmins({ kind: "superadmin", userId: "owner", value: false }), null);
  supers.length = 0;
  assert.equal(await actions.guardSuperadmins({ kind: "deactivate", userId: "anyone" }), null, "nothing to keep before the first superadmin");
});
