import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Row = { id: string; name: string; email: string; isActive: boolean };

function fixture({ rows = [] as Row[], workDevice = false, anywhere = false, device = null as null | { id: string } } = {}) {
  const audits: unknown[] = [];
  const lookups: string[] = [];
  const mod = serverModule<typeof import("./google-sign-in")>("src/lib/google-sign-in.ts", {
    "@/lib/prisma": { prisma: { user: { findUnique: async ({ where }: { where: { email: string } }) => { lookups.push(where.email); return rows.find((r) => r.email === where.email) ?? null; } } } },
    "@/lib/audit": { logAudit: async (input: unknown) => { audits.push(input); } },
    "@/lib/devices/shared-device": { currentSharedDevice: async () => device },
    "@/lib/devices/work-device": { workDeviceRequired: () => workDevice, mayWorkAnywhere: async () => anywhere },
  });
  return { ...mod, audits, lookups };
}

const staff: Row = { id: "staff-1", name: "Synthetic Manager", email: "manager@example.test", isActive: true };

test("Google sign-in is offered only when both Google settings are present", () => {
  const { googleSignInAvailable } = fixture();
  assert.equal(googleSignInAvailable({}), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id" }), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: " " }), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" }), true);
});

test("a verified Google email signs in as the active account with that email", async () => {
  const f = fixture({ rows: [staff] });
  assert.deepEqual(await f.googleStaffAccount({ email: " Manager@Example.test ", email_verified: true }), { user: { id: "staff-1", name: "Synthetic Manager", email: "manager@example.test" } });
});

test("Google never creates an account or opens a deactivated one", async () => {
  const f = fixture({ rows: [{ ...staff, isActive: false }] });
  assert.deepEqual(await f.googleStaffAccount({ email: "manager@example.test", email_verified: true }), { refused: "google_no_account" });
  assert.deepEqual(await f.googleStaffAccount({ email: "stranger@example.test", email_verified: true }), { refused: "google_no_account" });
});

test("an email Google has not verified is never matched", async () => {
  const f = fixture({ rows: [staff] });
  assert.deepEqual(await f.googleStaffAccount({ email: "manager@example.test", email_verified: false }), { refused: "google_no_account" });
  assert.deepEqual(await f.googleStaffAccount({ email: "manager@example.test" }), { refused: "google_no_account" });
  assert.deepEqual(await f.googleStaffAccount(null), { refused: "google_no_account" });
  assert.deepEqual(f.lookups, []);
});

test("the work-computer rule applies to Google as to a password", async () => {
  assert.deepEqual(await fixture({ rows: [staff], workDevice: true }).googleStaffAccount({ email: staff.email, email_verified: true }), { refused: "work_device" });
  assert.ok("user" in await fixture({ rows: [staff], workDevice: true, anywhere: true }).googleStaffAccount({ email: staff.email, email_verified: true }));
  assert.ok("user" in await fixture({ rows: [staff], workDevice: true, device: { id: "pc" } }).googleStaffAccount({ email: staff.email, email_verified: true }));
});

test("refusals read as plain sentences and unknown codes as none", () => {
  const f = fixture();
  assert.match(f.googleRefusalText("google_no_account") ?? "", /doesn't match an active Turnfin account/);
  assert.match(f.googleRefusalText("work_device") ?? "", /work computer/);
  assert.equal(f.googleRefusalText("toString"), null);
  assert.equal(f.googleRefusalText(undefined), null);
});

test("a Google sign-in is written to the account's history", async () => {
  const f = fixture();
  await f.auditGoogleSignIn({ id: "staff-1", name: "Synthetic Manager" });
  assert.deepEqual(f.audits, [{ actorId: "staff-1", actorName: "Synthetic Manager", action: "sign_in", entity: "User", entityId: "staff-1", summary: "Signed in with Google" }]);
});
