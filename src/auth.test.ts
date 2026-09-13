import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { ALL_PERMISSIONS, expandPermissions } from "@/lib/staff/permissions";
import { ALL_SCREENS, visibleScreens } from "@/lib/staff/screens";

function fixture() {
  const administrator = { id: "role-1", name: "Renamed management team", permissions: ["staff.manage", "roles.manage"], home: "overview", screens: ["overview"] };
  const account = { id: "staff-1", name: "Synthetic Manager", email: "manager@example.test", isActive: true, staffRole: administrator as typeof administrator | null };
  let preview: typeof administrator | null = null;
  const { auth } = serverModule<typeof import("./auth")>("src/auth.ts", {
    "next-auth": () => ({ auth: async () => ({ user: { id: account.id }, expires: "2099-01-01" }), handlers: {}, signIn: async () => {}, signOut: async () => {} }),
    "next-auth/providers/credentials": (options: unknown) => options,
    "@/lib/prisma": { prisma: { user: { findUnique: async () => account } } },
    "@/lib/auth-cookies": { authCookies: () => undefined },
    "@/lib/dev-sign-in": { devSignInAllowed: () => false },
    "@/lib/staff/preview": { mayPreview: (permissions: string[]) => permissions.includes("roles.manage"), previewedRole: async () => preview },
  });
  return { auth, account, preview: (role: typeof preview) => { preview = role; } };
}

function access(session: Session | null) {
  assert.ok(session);
  const permissions = expandPermissions(session.user.permissions);
  return { permissions: [...permissions], screens: [...visibleScreens(session.user.screens, permissions)] };
}

test("renamed administrators get full access from current grants without updating stored screen lists", async () => {
  const f = fixture();
  assert.deepEqual(access(await f.auth()), { permissions: ALL_PERMISSIONS, screens: ALL_SCREENS });
});

test("role previews replace administrator access and restoring the role restores full access", async () => {
  const f = fixture();
  f.preview({ id: "deck-role", name: "Instructor", permissions: ["attendance.mark"], screens: ["instructor"], home: "instructor" });
  assert.deepEqual(access(await f.auth()), { permissions: ["attendance.mark"], screens: ["instructor"] });
  f.preview(null);
  assert.deepEqual(access(await f.auth()), { permissions: ALL_PERMISSIONS, screens: ALL_SCREENS });
});

test("demotion, deactivation and removing a role revoke administrator access on the next request", async () => {
  const f = fixture();
  assert.equal(access(await f.auth()).screens.includes("duty"), true);
  f.account.staffRole!.permissions = ["staff.manage"];
  assert.deepEqual(access(await f.auth()), { permissions: ["staff.manage"], screens: [] });
  f.account.isActive = false;
  assert.equal(await f.auth(), null);
  f.account.isActive = true;
  f.account.staffRole = null;
  assert.equal(await f.auth(), null);
});
