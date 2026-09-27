import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_PERMISSIONS, UNRESTRICTED_PERMISSIONS, expandPermissions, hasAdministratorAccess, isRestrictedPermission } from "./permissions";

test("administrator grants include the whole catalogue except restricted keys; superadmins hold everything", () => {
  const stored = ["staff.manage", "roles.manage", "retired.permission"];
  assert.deepEqual([...expandPermissions(stored)], UNRESTRICTED_PERMISSIONS);
  assert.ok(ALL_PERMISSIONS.some(isRestrictedPermission), "HR keys are restricted");
  assert.equal(expandPermissions(stored).has("hr.records.read"), false);
  assert.deepEqual([...expandPermissions([], { superadmin: true })], ALL_PERMISSIONS);
  assert.deepEqual(stored, ["staff.manage", "roles.manage", "retired.permission"]);
  assert.equal(expandPermissions(stored).has("classes.cancel"), true);
  assert.equal(expandPermissions(stored).has("billing.notify"), true);
  assert.equal(expandPermissions(stored).has("parents.manage"), true);
});

test("unknown keys and either management permission alone cannot grant administrator access", () => {
  for (const stored of [[], ["Admin"], ["ADMIN"], ["*"], ["staff.manage"], ["roles.manage"]]) {
    assert.equal(hasAdministratorAccess(stored), false);
    assert.equal(expandPermissions(stored).has("classes.cancel"), false);
    assert.equal(expandPermissions(stored).has("billing.notify"), false);
  }
});

test("ordinary permission implications still apply without widening access", () => {
  assert.deepEqual([...expandPermissions(["attendance.markAny", "retired"])], ["attendance.markAny", "attendance.mark", "attendance.cover"]);
  assert.deepEqual([...expandPermissions(["progression.override"])], ["progression.override", "progression.complete", "progression.assess"]);
});
