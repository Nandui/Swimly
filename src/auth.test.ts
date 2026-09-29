import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { UNRESTRICTED_PERMISSIONS, expandPermissions } from "@/lib/staff/permissions";
import { ADMINISTRATOR_SCREENS, visibleScreens } from "@/lib/staff/screens";

function fixture() {
  type Role = { id: string; name: string; permissions: string[]; levels?: Record<string, string> };
  const administrator: Role = { id: "role-1", name: "Renamed management team", permissions: ["staff.manage", "roles.manage"] };
  const account = { id: "staff-1", name: "Synthetic Manager", email: "manager@example.test", isActive: true, staffRole: administrator as Role | null };
  let preview: Role | null = null;
  const { auth } = serverModule<typeof import("./auth")>("src/auth.ts", {
    "next-auth": Object.assign(() => ({ auth: async () => ({ user: { id: account.id }, expires: "2099-01-01" }), handlers: {}, signIn: async () => {}, signOut: async () => {} }), { CredentialsSignin: class extends Error {} }),
    "next-auth/providers/credentials": (options: unknown) => options,
    "@/lib/prisma": { prisma: { user: { findUnique: async () => account } } },
    "@/lib/auth-cookies": { authCookies: () => undefined },
    "@/lib/dev-sign-in": { devSignInAllowed: () => false },
    "@/lib/staff/preview": { mayPreview: (permissions: string[]) => permissions.includes("roles.manage"), previewedRole: async () => preview },
    "@/lib/clubs/current": { getCurrentClub: async () => ({ club: { id: "club-1", name: "Synthetic site" }, clubs: [] }) },
    "@/lib/devices/shared-device": { currentSharedDevice: async () => null, SHARED_SESSION_MAX_MS: 12 * 60 * 60 * 1000 },
    "@/lib/devices/pin": { authorizePin: async () => null },
    "@/lib/devices/work-device": { workDeviceRequired: () => false, mayWorkAnywhere: async () => true },
  });
  return { auth, account, preview: (role: typeof preview) => { preview = role; } };
}

function access(session: Session | null) {
  assert.ok(session);
  const permissions = expandPermissions(session.user.permissions);
  return { permissions: [...permissions], screens: [...visibleScreens(permissions)] };
}

test("renamed administrators get full access from current grants", async () => {
  const f = fixture();
  assert.deepEqual(access(await f.auth()), { permissions: UNRESTRICTED_PERMISSIONS, screens: ADMINISTRATOR_SCREENS });
});

test("role previews replace administrator access and restoring the role restores full access", async () => {
  const f = fixture();
  f.preview({ id: "deck-role", name: "Instructor", permissions: ["attendance.mark"] });
  assert.deepEqual(access(await f.auth()), { permissions: ["attendance.mark"], screens: ["instructor"] });
  f.preview(null);
  assert.deepEqual(access(await f.auth()), { permissions: UNRESTRICTED_PERMISSIONS, screens: ADMINISTRATOR_SCREENS });
});

test("a previewed role is built from its levels in every module, not its stored keys", async () => {
  const f = fixture();
  // Stored keys left over from before levels must not leak into the preview.
  f.preview({ id: "reception", name: "Receptionist", permissions: ["students.manage"], levels: { refunds: "use", docs: "read" } });
  const session = await f.auth();
  const permissions: string[] = access(session).permissions;
  for (const key of ["refunds.request", "docs.read"]) assert.ok(permissions.includes(key), key);
  assert.ok(!permissions.includes("students.manage"));
  assert.equal(session!.user.roleName, "Receptionist");
  assert.equal(session!.user.isSuperadmin, false);
  assert.deepEqual(session!.user.preview?.actualPermissions, ["staff.manage", "roles.manage"]);
});

test("demotion, deactivation and removing a role revoke administrator access on the next request", async () => {
  const f = fixture();
  assert.equal(access(await f.auth()).screens.includes("duty"), true);
  f.account.staffRole!.permissions = ["staff.manage"];
  assert.deepEqual(access(await f.auth()), { permissions: ["staff.manage"], screens: ["staff"] });
  f.account.isActive = false;
  assert.equal(await f.auth(), null);
  f.account.isActive = true;
  f.account.staffRole = null;
  assert.equal(await f.auth(), null);
});
