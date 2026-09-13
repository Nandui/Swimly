import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import type { Session } from "next-auth";
import { ALL_PERMISSIONS } from "@/lib/staff/permissions";
import { ALL_SCREENS } from "@/lib/staff/screens";

test("authenticated access awaits due unenrolments before returning the session", async () => {
  const calls: string[] = [];
  const guards = serverModule<typeof import("./authz")>("src/lib/authz.ts", {
    "@/auth": { auth: async () => { calls.push("auth"); return { user: { id: "staff" } }; } },
    "@/lib/enrolment/scheduled": { processScheduledUnenrolments: async () => { await Promise.resolve(); calls.push("due"); } },
  });
  await guards.requireSession(); calls.push("read");
  assert.deepEqual(calls, ["auth", "due", "read"]);
});

test("unauthenticated requests do not process scheduled unenrolments", async () => {
  let processed = false;
  const guards = serverModule<typeof import("./authz")>("src/lib/authz.ts", {
    "@/auth": { auth: async () => null },
    "@/lib/enrolment/scheduled": { processScheduledUnenrolments: async () => { processed = true; } },
  });
  await assert.rejects(guards.requireSession(), /Not signed in/);
  assert.equal(processed, false);
});

test("named permission and screen guards accept administrators and refuse restricted managers", async () => {
  const session = { user: { id: "staff", roleName: "Custom admin name", permissions: ["staff.manage", "roles.manage"], screens: [] } } as unknown as Session;
  const guards = serverModule<typeof import("./authz")>("src/lib/authz.ts", {
    "@/auth": { auth: async () => session },
    "@/lib/enrolment/scheduled": { processScheduledUnenrolments: async () => {} },
  });
  for (const permission of ALL_PERMISSIONS) {
    assert.equal(guards.can(session, permission), true);
    await guards.requirePermission(permission);
  }
  for (const screen of ALL_SCREENS) assert.equal(guards.canSee(session, screen), true);
  session.user.permissions = ["staff.manage"];
  await assert.rejects(guards.requirePermission("classes.cancel"), /do not have permission/);
  await assert.rejects(guards.requirePermission("billing.notify"), /do not have permission/);
  assert.equal(guards.canSee(session, "duty"), false);
  assert.equal(guards.canSee(session, "cancellations"), false);
});
