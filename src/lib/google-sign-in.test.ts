import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Row = { id: string; name: string; email: string; isActive: boolean; staffRoleId: string | null; googleId: string | null; avatarUrl: string | null; orgId?: string | null; pinHash?: string | null; lastSignInAt?: Date | null; pinFailures?: number; pinLockedAt?: Date | null };

/** An in-memory account table: enough of Prisma for sign-in. */
function fixture({ rows = [] as Row[], workDevice = false, anywhere = false, device = null as null | { id: string; orgId: string } } = {}) {
  const audits: { summary: string; action: string }[] = [];
  const quickSwitch: string[] = [];
  const pick = (row: Row | undefined) => (row ? { ...row } : null);
  const user = {
    findUnique: async ({ where }: { where: { email?: string; googleId?: string } }) =>
      pick(rows.find((r) => (where.email !== undefined ? r.email === where.email : r.googleId === where.googleId))),
    create: async ({ data }: { data: Omit<Row, "id" | "isActive" | "staffRoleId"> }) => {
      if (rows.some((r) => r.email === data.email || r.googleId === data.googleId)) throw new Error("unique");
      const row: Row = { id: `made-${rows.length + 1}`, isActive: true, staffRoleId: null, ...data };
      rows.push(row);
      return { ...row };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return { ...row };
    },
  };
  const mod = serverModule<typeof import("./google-sign-in")>("src/lib/google-sign-in.ts", {
    "@/lib/prisma": { prisma: {
      user,
      organisation: { findFirst: async () => ({ id: "org-lw" }) },
      sharedDeviceUser: { upsert: async ({ create }: { create: { userId: string } }) => { quickSwitch.push(create.userId); } },
    } },
    "@/lib/audit": { logAudit: async (input: { summary: string; action: string }) => { audits.push(input); } },
    "@/lib/devices/shared-device": { currentSharedDevice: async () => device },
    "@/lib/devices/work-device": { workDeviceRequired: () => workDevice, mayWorkAnywhere: async () => anywhere },
  });
  return { ...mod, audits, rows, quickSwitch };
}

const staff: Row = { id: "staff-1", name: "Synthetic Manager", email: "manager@leisureworldcork.com", isActive: true, staffRoleId: "role-1", googleId: null, avatarUrl: null, orgId: "org-lw" };
const profile = (over: Record<string, unknown> = {}) => ({
  sub: "g-100", email: "manager@leisureworldcork.com", email_verified: true, hd: "leisureworldcork.com",
  name: "Synthetic Manager", picture: "https://lh3.googleusercontent.com/a/synthetic", auth_time: Math.floor(Date.now() / 1000), ...over,
});

test("Google sign-in is offered only when both Google settings are present", () => {
  const { googleSignInAvailable } = fixture();
  assert.equal(googleSignInAvailable({}), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id" }), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: " " }), false);
  assert.equal(googleSignInAvailable({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" }), true);
});

test("the work domain gets accounts by default, and the setting can change it", () => {
  const f = fixture();
  assert.deepEqual(f.googleAccountDomains({}), ["leisureworldcork.com"]);
  assert.deepEqual(f.googleAccountDomains({ AUTH_GOOGLE_DOMAINS: " A.ie, b.ie ,a.ie" }), ["a.ie", "b.ie"]);
});

test("an existing account signs in, linking its Google id and taking the name and picture", async () => {
  const f = fixture({ rows: [{ ...staff, name: "Old Name" }] });
  assert.deepEqual(await f.googleSignIn(profile({ email: " Manager@LeisureWorldCork.com " })), { user: { id: "staff-1", name: "Synthetic Manager", email: "manager@leisureworldcork.com" } });
  assert.equal(f.rows[0].googleId, "g-100");
  assert.equal(f.rows[0].avatarUrl, "https://lh3.googleusercontent.com/a/synthetic");
  assert.match(f.audits[0].summary, /Google changed name from "Old Name" to "Synthetic Manager"/);
});

test("a first sign-in from the work domain makes an account with no role, which waits", async () => {
  const f = fixture();
  assert.deepEqual(await f.googleSignIn(profile({ sub: "g-new", email: "new.starter@leisureworldcork.com", name: "New Starter" })), { refused: "google_waiting" });
  assert.equal(f.rows.length, 1);
  assert.deepEqual({ ...f.rows[0] }, { id: "made-1", isActive: true, staffRoleId: null, name: "New Starter", email: "new.starter@leisureworldcork.com", googleId: "g-new", avatarUrl: "https://lh3.googleusercontent.com/a/synthetic", orgId: "org-lw" });
  assert.equal(f.audits[0].action, "create");
  // Signing in again finds it, still waiting, and makes no second account.
  assert.deepEqual(await f.googleSignIn(profile({ sub: "g-new", email: "new.starter@leisureworldcork.com", name: "New Starter" })), { refused: "google_waiting" });
  assert.equal(f.rows.length, 1);
  // Once a manager gives a role, they are in.
  f.rows[0].staffRoleId = "role-1";
  assert.ok("user" in await f.googleSignIn(profile({ sub: "g-new", email: "new.starter@leisureworldcork.com", name: "New Starter" })));
});

test("no account is made outside the work domain, or for a personal Google account", async () => {
  const f = fixture();
  assert.deepEqual(await f.googleSignIn(profile({ email: "someone@gmail.com", hd: undefined })), { refused: "google_no_account" });
  assert.deepEqual(await f.googleSignIn(profile({ email: "someone@other.ie", hd: "other.ie" })), { refused: "google_no_account" });
  // A Workspace domain claim must match the address itself.
  assert.deepEqual(await f.googleSignIn(profile({ email: "someone@other.ie", hd: "leisureworldcork.com" })), { refused: "google_no_account" });
  assert.equal(f.rows.length, 0);
});

test("a deactivated account stays shut and is not changed", async () => {
  const f = fixture({ rows: [{ ...staff, isActive: false, name: "Old Name" }] });
  assert.deepEqual(await f.googleSignIn(profile()), { refused: "google_no_account" });
  assert.equal(f.rows[0].name, "Old Name");
  assert.equal(f.rows.length, 1);
});

test("the Google id finds the account after the address changes, and the new address is taken", async () => {
  const f = fixture({ rows: [{ ...staff, googleId: "g-100" }] });
  assert.ok("user" in await f.googleSignIn(profile({ email: "m.manager@leisureworldcork.com" })));
  assert.equal(f.rows[0].email, "m.manager@leisureworldcork.com");
  assert.equal(f.rows.length, 1);
});

test("an email Google has not verified is never matched or used", async () => {
  const f = fixture({ rows: [staff] });
  assert.deepEqual(await f.googleSignIn(profile({ email_verified: false })), { refused: "google_no_account" });
  assert.deepEqual(await f.googleSignIn(profile({ email_verified: undefined })), { refused: "google_no_account" });
  assert.deepEqual(await f.googleSignIn(null), { refused: "google_no_account" });
  assert.equal(f.rows[0].googleId, null);
});

test("only an https picture is kept, and a missing name falls back", () => {
  const f = fixture();
  assert.equal(f.googleIdentity(profile({ picture: "http://example.test/a.png" }))?.avatarUrl, null);
  assert.equal(f.googleIdentity(profile({ name: "", given_name: "Aoife", family_name: "Ryan" }))?.name, "Aoife Ryan");
  assert.equal(f.googleIdentity(profile({ name: undefined }))?.name, "manager");
});

test("the work-computer rule applies to Google as to a password", async () => {
  assert.deepEqual(await fixture({ rows: [{ ...staff }], workDevice: true }).googleSignIn(profile()), { refused: "work_device" });
  assert.ok("user" in await fixture({ rows: [{ ...staff }], workDevice: true, anywhere: true }).googleSignIn(profile()));
  assert.ok("user" in await fixture({ rows: [{ ...staff }], workDevice: true, device: { id: "pc", orgId: "org-lw" } }).googleSignIn(profile()));
});

test("the token lookup reads without making or changing anything", async () => {
  const f = fixture();
  assert.deepEqual(await f.googleStaffAccount(profile()), { refused: "google_no_account" });
  assert.equal(f.rows.length, 0);
});

test("a recorded sign-in clears a PIN lock, adds a PIN holder to the work device, and is logged", async () => {
  const f = fixture({ rows: [{ ...staff, pinHash: "hash", pinFailures: 5, pinLockedAt: new Date() }], device: { id: "pc", orgId: "org-lw" } });
  assert.equal(await f.recordGoogleSignIn({ id: "staff-1", name: "Synthetic Manager" }), true);
  assert.equal(f.rows[0].pinFailures, 0);
  assert.equal(f.rows[0].pinLockedAt, null);
  assert.ok(f.rows[0].lastSignInAt instanceof Date);
  assert.deepEqual(f.quickSwitch, ["staff-1"]);
  assert.equal(f.audits.at(-1)?.summary, "Signed in with Google");
});

test("how fresh a Google sign-in is, which is only logged for now", async () => {
  const f = fixture({ rows: [{ ...staff }] });
  const now = Date.now();
  assert.equal(f.freshGoogleSignIn(profile({ auth_time: Math.floor(now / 1000) - 30 }), now), true);
  // A browser that was still signed in to Google from earlier.
  assert.equal(f.freshGoogleSignIn(profile({ auth_time: Math.floor(now / 1000) - 60 * 60 }), now), false);
  assert.equal(f.freshGoogleSignIn(profile({ auth_time: undefined }), now), false);
  assert.equal(f.freshGoogleSignIn(profile({ auth_time: "1700000000" }), now), false);
  // Not enforced yet: a stale or missing time still signs in.
  assert.ok("user" in await f.googleSignIn(profile({ auth_time: Math.floor(now / 1000) - 60 * 60 })));
  assert.ok("user" in await f.googleSignIn(profile({ auth_time: undefined })));
});

test("refusals read as plain sentences and unknown codes as none", () => {
  const f = fixture();
  assert.match(f.googleRefusalText("google_no_account") ?? "", /can't sign in to Turnfin/);
  assert.match(f.googleRefusalText("google_waiting") ?? "", /ask your manager to give you a role/i);
  assert.match(f.googleRefusalText("google_password") ?? "", /didn't ask for your password/);
  assert.match(f.googleRefusalText("work_device") ?? "", /work computer/);
  assert.equal(f.googleRefusalText("toString"), null);
  assert.equal(f.googleRefusalText(undefined), null);
});
