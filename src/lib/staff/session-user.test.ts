import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionUserFor, type Account } from "./session-user";

const account = (assignments: Account["roleAssignments"]): Account => ({
  id: "ava", name: "Ava", email: "ava@example.invalid", isActive: true, orgId: "lw", isSuperadmin: false,
  staffRole: { id: "instructor", name: "Instructor", permissions: ["attendance.mark"], home: "instructor", screens: ["instructor"] },
  roleAssignments: assignments,
});
const dutyManager = { name: "Duty manager", permissions: ["classes.cancel"], screens: ["duty"] };

test("an additional role counts in the flat checks only everywhere or at its own site", () => {
  const user = sessionUserFor(account([
    { scopeKind: "site", scopeId: "churchfield", role: dutyManager },
    { scopeKind: "department", scopeId: "aquatics", role: { name: "Lead", permissions: ["courses.manage"], screens: ["courses"] } },
    { scopeKind: "reports", scopeId: "", role: { name: "Manager", permissions: ["students.manage"], screens: ["students"] } },
  ]), "churchfield")!;
  assert.deepEqual(user.permissions.sort(), ["attendance.mark", "classes.cancel"]);
  assert.deepEqual(user.screens.sort(), ["duty", "instructor"]);
  // Every assignment still reaches the policy engine, with its scope.
  assert.equal(user.grants.length, 3);
});

test("at another site the site-limited role adds nothing", () => {
  const user = sessionUserFor(account([{ scopeKind: "site", scopeId: "churchfield", role: dutyManager }]), "bishopstown")!;
  assert.deepEqual(user.permissions, ["attendance.mark"]);
  assert.deepEqual(user.screens, ["instructor"]);
});

test("an org-wide additional role adds everywhere; no primary role still reads as signed out", () => {
  const user = sessionUserFor(account([{ scopeKind: "all", scopeId: "", role: dutyManager }]), null)!;
  assert.ok(user.permissions.includes("classes.cancel"));
  assert.equal(sessionUserFor({ ...account([]), staffRole: null }, null), null);
});
