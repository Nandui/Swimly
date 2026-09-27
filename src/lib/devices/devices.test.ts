import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

/** Shared devices and quick-switch PINs against a real (in-memory) Postgres. */
process.env.AUTH_SECRET = "test-only-secret-for-device-cookies-000000";
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let pin: typeof import("./pin");
let device: typeof import("./shared-device");
let actions: typeof import("./actions");
const ORG = "org_leisureworld";
const jar = new Map<string, string>();
const state = { userId: "ava" };

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const role = await db.staffRole.create({ data: { name: "Test staff", permissions: ["docs.read"], screens: ["docs"] } });
  const hash = await bcrypt.hash("correct-horse-battery", 4);
  for (const id of ["ava", "noah", "admin"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role.id, orgId: ORG, passwordHash: hash } });
  await db.organisation.create({ data: { id: "org-other", name: "Other", slug: "other" } });
  await db.user.create({ data: { id: "zoe", name: "zoe", email: "zoe@example.invalid", staffRoleId: role.id, orgId: "org-other", passwordHash: hash, pinHash: await bcrypt.hash("2580", 4) } });
  await db.sharedDevice.create({ data: { id: "dev-1", orgId: ORG, name: "Churchfield reception" } });
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined), set: (name: string, value: string) => jar.set(name, value), delete: (name: string) => jar.delete(name) }) },
    "@/lib/authz": {
      requireSession: async () => ({ user: { id: state.userId, name: state.userId, orgId: ORG } }),
      requirePermission: async () => ({ user: { id: "admin", name: "Admin", orgId: ORG } }),
    },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
  };
  pin = serverModule("src/lib/devices/pin.ts", doubles);
  device = serverModule("src/lib/devices/shared-device.ts", doubles);
  actions = serverModule("src/lib/devices/actions.ts", doubles);
});
after(async () => { await fixture?.close(); });

test("device cookies are signed and cannot be forged or moved", () => {
  const signed = device.signDevice("dev-1");
  assert.equal(device.verifyDevice(signed), "dev-1");
  assert.equal(device.verifyDevice(signed.replace("dev-1", "dev-2")), null);
  assert.equal(device.verifyDevice("dev-1.forged"), null);
  assert.equal(device.verifyDevice(undefined), null);
});

test("PINs refuse obvious patterns", () => {
  for (const bad of ["123", "0000", "1234", "9876", "12345678", "12a4"]) assert.ok(device.pinProblem(bad), bad);
  for (const good of ["2580", "7193", "402815"]) assert.equal(device.pinProblem(good), null, good);
});

test("setting a PIN needs the current password, and on a shared device joins its quick-switch list", async () => {
  jar.set(device.DEVICE_COOKIE, device.signDevice("dev-1"));
  state.userId = "ava";
  assert.equal((await actions.setOwnPin("wrong-password", "2580")).ok, false);
  assert.equal((await actions.setOwnPin("correct-horse-battery", "1111")).ok, false, "weak PIN");
  assert.deepEqual(await actions.setOwnPin("correct-horse-battery", "2580"), { ok: true });
  assert.ok(await fixture.prisma.sharedDeviceUser.findUnique({ where: { deviceId_userId: { deviceId: "dev-1", userId: "ava" } } }));
});

test("quick switch: only listed people, only on a live device, locked after five wrong PINs", async () => {
  const here = await device.currentSharedDevice();
  assert.equal(here?.id, "dev-1");
  assert.equal((await pin.authorizePin(here, "ava", "2580"))?.id, "ava");
  assert.equal(await pin.authorizePin(here, "noah", "2580"), null, "noah is not on this device's list");
  assert.equal(await pin.authorizePin(null, "ava", "2580"), null, "not a shared device");
  await fixture.prisma.sharedDeviceUser.create({ data: { deviceId: "dev-1", userId: "zoe" } });
  assert.equal(await pin.authorizePin(here, "zoe", "2580"), null, "another organisation");
  for (let i = 0; i < 5; i++) assert.equal(await pin.authorizePin(here, "ava", "9999"), null);
  assert.equal(await pin.authorizePin(here, "ava", "2580"), null, "locked, even with the right PIN");
  assert.ok((await fixture.prisma.user.findUniqueOrThrow({ where: { id: "ava" } })).pinLockedAt);
});

test("revoking a device ends quick switch there and clears its list", async () => {
  await fixture.prisma.user.update({ where: { id: "ava" }, data: { pinLockedAt: null, pinFailures: 0 } });
  assert.deepEqual(await actions.revokeDevice("dev-1"), { ok: true });
  assert.equal(await device.currentSharedDevice(), null);
  assert.equal(await fixture.prisma.sharedDeviceUser.count({ where: { deviceId: "dev-1" } }), 0);
});
