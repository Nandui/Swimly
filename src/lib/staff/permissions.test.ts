import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_PERMISSIONS, expandPermissions, hasAdministratorAccess } from "./permissions";

test("administrator grants always include the whole permission catalogue", () => {
  const stored = ["staff.manage", "roles.manage", "retired.permission"];
  assert.deepEqual([...expandPermissions(stored)], ALL_PERMISSIONS);
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
