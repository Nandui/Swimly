import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

const access = serverModule<typeof import("./access")>("src/lib/attendance/access.ts", {
  "@/lib/authz": { can: (session: Session, key: PermissionKey) => expandPermissions(session.user.permissions).has(key) },
});
const session = (permissions: PermissionKey[]) => ({ user: { id: "teacher", permissions } }) as Session;

test("poolside teaching requires a recorded start but never exclusive ownership", () => {
  const args = { session: session(["attendance.markAny"]), instructorId: "colleague" };
  assert.equal(access.canMarkRegister(args), true);
  assert.equal(access.canTeachClass(args), false);
  assert.equal(access.needsTakeOver(args), true);
  assert.equal(access.canTeachClass({ ...args, coverById: "teacher" }), true);
  assert.equal(access.canTeachClass({ ...args, instructorId: "teacher" }), false);
  assert.equal(access.canTeachClass({ ...args, instructorId: "teacher", coverById: "colleague" }), true);
  assert.equal(access.canTeachClass({ ...args, coverById: null }), true);
});

test("read-only staff cannot teach and cover without permission is not offered", () => {
  assert.equal(access.canTeachClass({ session: session([]), instructorId: "teacher" }), false);
  assert.equal(access.canTeachClass({ session: session([]), instructorId: "teacher", coverById: "colleague" }), false);
  assert.equal(access.canTeachClass({ session: session(["attendance.mark"]), instructorId: "colleague", coverById: "colleague" }), true);
  assert.equal(access.needsTakeOver({ session: session(["attendance.mark"]), instructorId: "colleague" }), false);
  assert.equal(access.canTeachClass({ session: session(["attendance.mark"]), instructorId: null, coverById: "teacher" }), true);
});

test("administrators still need a recorded start and may share another instructor's session", () => {
  const args = { session: session(["staff.manage", "roles.manage"]), instructorId: "teacher" };
  assert.equal(access.canMarkRegister(args), true);
  assert.equal(access.canTeachClass(args), false);
  assert.equal(access.canTeachClass({ ...args, coverById: "colleague" }), true);
  assert.equal(access.canTeachClass({ ...args, coverById: "teacher" }), true);
});
