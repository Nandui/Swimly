"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { BCRYPT_ROUNDS } from "@/lib/staff/passwords";
import { DEVICE_COOKIE, currentSharedDevice, deviceCookieOptions, pinProblem, signDevice } from "@/lib/devices/shared-device";

/** Shared devices and quick-switch PINs. Registering or revoking a device is
 *  account administration (`staff.manage`); a PIN is the person's own, set
 *  and removed with their current password. Every change is audited. */

const name = (session: { user: { name?: string | null } }) => session.user.name ?? "Unknown";

const deviceSchema = z.object({
  name: z.string().trim().min(1, "Name the device, for example Churchfield reception.").max(60, "Keep the name under 60 characters."),
  clubId: z.string().trim().max(64).transform((v) => v || null),
});

/** Marks *this browser* as a shared device. */
export async function registerThisDevice(input: z.input<typeof deviceSchema>): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account has no organisation.");
  if (parsed.data.clubId && !(await prisma.club.findFirst({ where: { id: parsed.data.clubId, orgId } }))) return fail("Choose one of your sites.");
  const device = await prisma.$transaction(async (tx) => {
    const created = await tx.sharedDevice.create({ data: { orgId, name: parsed.data.name, clubId: parsed.data.clubId, createdById: session.user.id } });
    await logAudit({ actorId: session.user.id, actorName: name(session), action: "register-device", entity: "SharedDevice", entityId: created.id, clubId: parsed.data.clubId, summary: `Registered this browser as the shared device ${created.name}` }, tx);
    return created;
  });
  (await cookies()).set(DEVICE_COOKIE, signDevice(device.id), deviceCookieOptions);
  revalidatePath("/staff/devices");
  return ok();
}

/** Stops treating this browser as shared (for example a PC moved to an office). */
export async function forgetThisDevice(): Promise<ActionResult> {
  await requireSession();
  (await cookies()).delete(DEVICE_COOKIE);
  revalidatePath("/staff/devices");
  return ok();
}

export async function revokeDevice(id: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const result = await prisma.$transaction(async (tx) => {
    const device = await tx.sharedDevice.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true, revokedAt: true, clubId: true } });
    if (!device) return fail("That device no longer exists.");
    if (device.revokedAt) return ok();
    await tx.sharedDevice.update({ where: { id }, data: { revokedAt: new Date() } });
    await tx.sharedDeviceUser.deleteMany({ where: { deviceId: id } });
    await logAudit({ actorId: session.user.id, actorName: name(session), action: "revoke-device", entity: "SharedDevice", entityId: id, clubId: device.clubId, summary: `Revoked the shared device ${device.name}; quick switch stops there immediately` }, tx);
    return ok();
  });
  revalidatePath("/staff/devices");
  return result;
}

async function checkPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, name: true } });
  return user?.passwordHash && (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}

/** Sets or changes the person's own quick-switch PIN. */
export async function setOwnPin(currentPassword: string, pin: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.preview) return fail("Stop previewing a role before changing your PIN.");
  const problem = pinProblem(String(pin ?? ""));
  if (problem) return fail(problem);
  const user = await checkPassword(session.user.id, String(currentPassword ?? ""));
  if (!user) return fail("That password is not right.");
  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { pinHash, pinFailures: 0, pinLockedAt: null } });
    await logAudit({ actorId: session.user.id, actorName: user.name, action: "set-pin", entity: "User", entityId: session.user.id, summary: `${user.name} set a quick-switch PIN` }, tx);
  });
  // Signing in on this device with the password added them if it is shared;
  // setting a PIN here does the same, so they can switch in next time.
  const device = await currentSharedDevice();
  if (device && device.orgId === session.user.orgId) {
    await prisma.sharedDeviceUser.upsert({ where: { deviceId_userId: { deviceId: device.id, userId: session.user.id } }, update: {}, create: { deviceId: device.id, userId: session.user.id } });
  }
  revalidatePath("/account");
  return ok();
}

export async function removeOwnPin(currentPassword: string): Promise<ActionResult> {
  const session = await requireSession();
  const user = await checkPassword(session.user.id, String(currentPassword ?? ""));
  if (!user) return fail("That password is not right.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { pinHash: null, pinFailures: 0, pinLockedAt: null } });
    await tx.sharedDeviceUser.deleteMany({ where: { userId: session.user.id } });
    await logAudit({ actorId: session.user.id, actorName: user.name, action: "remove-pin", entity: "User", entityId: session.user.id, summary: `${user.name} removed their quick-switch PIN` }, tx);
  });
  revalidatePath("/account");
  return ok();
}

