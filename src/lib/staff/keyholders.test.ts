import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

function fixture() {
  let userReads = 0;
  let roleReads = 0;
  const roles = [{ id: "keyholder", permissions: ["staff.manage", "roles.manage"], screens: ["staff", "roles"] }];
  const prisma = {
    user: { findMany: async () => { userReads++; return [{ id: "staff", staffRoleId: "keyholder" }]; } },
    staffRole: { findMany: async () => { roleReads++; return roles; } },
  };
  const actions = serverModule<typeof import("./keyholders")>("src/lib/staff/keyholders.ts", { "@/lib/prisma": { prisma } });
  return { actions, roles, reads: () => ({ userReads, roleReads }) };
}

test("keyholder checks read users and roles once for both required permissions", async () => {
  const f = fixture();
  assert.equal(await f.actions.guardKeyholders({ kind: "rolePermissions", roleId: "keyholder", permissions: ["staff.manage", "roles.manage"], screens: ["staff", "roles"] }), null);
  assert.deepEqual(f.reads(), { userReads: 1, roleReads: 1 });
});

test("administrator access preserves both management screens without explicit screen grants", async () => {
  const f = fixture();
  assert.equal(await f.actions.guardKeyholders({ kind: "rolePermissions", roleId: "keyholder", permissions: ["staff.manage", "roles.manage"], screens: [] }), null);
});

test("removing either management key still cannot leave the app without a keyholder", async () => {
  for (const permission of ["staff.manage", "roles.manage"]) {
    const f = fixture();
    assert.notEqual(await f.actions.guardKeyholders({ kind: "rolePermissions", roleId: "keyholder", permissions: [permission], screens: ["staff", "roles"] }), null);
  }
});

test("restricted managers still need their management screen", async () => {
  const f = fixture();
  f.roles.push({ id: "staff-only", permissions: ["staff.manage"], screens: ["staff"] });
  assert.equal(await f.actions.activeHoldersOf({ permission: "staff.manage", screen: "staff" }, { kind: "userRole", userId: "staff", roleId: "staff-only" }), 1);
  f.roles[1].screens = [];
  assert.equal(await f.actions.activeHoldersOf({ permission: "staff.manage", screen: "staff" }, { kind: "userRole", userId: "staff", roleId: "staff-only" }), 0);
});

test("the last active keyholder cannot be deactivated", async () => {
  const f = fixture();
  assert.notEqual(await f.actions.guardKeyholders({ kind: "deactivate", userId: "staff" }), null);
});
