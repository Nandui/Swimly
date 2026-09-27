import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PIN_MAX_FAILURES, type SharedDeviceInfo } from "@/lib/devices/shared-device";

/** Checks a quick-switch PIN on a shared device. Returns the person, or null
 *  for every failure alike (no hint about which part was wrong).
 *
 *  Only someone on this device's quick-switch list (they signed in here with
 *  their password and have a PIN), active, in the device's organisation and
 *  not locked can switch in. Five wrong PINs lock the PIN until the person
 *  signs in with their password again. */
export async function authorizePin(device: SharedDeviceInfo | null, userId: string, pin: string) {
  if (!device || !userId || !/^\d{4,8}$/.test(pin)) return null;
  const member = await prisma.sharedDeviceUser.findUnique({ where: { deviceId_userId: { deviceId: device.id, userId } } });
  const user = member ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user?.isActive || !user.pinHash || user.pinLockedAt || user.orgId !== device.orgId) return null;
  if (!(await bcrypt.compare(pin, user.pinHash))) {
    const failures = user.pinFailures + 1;
    await prisma.user.update({ where: { id: user.id }, data: { pinFailures: failures, pinLockedAt: failures >= PIN_MAX_FAILURES ? new Date() : null } });
    return null;
  }
  const now = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { pinFailures: 0 } });
  await prisma.sharedDeviceUser.update({ where: { deviceId_userId: { deviceId: device.id, userId } }, data: { lastUsedAt: now } });
  await prisma.sharedDevice.update({ where: { id: device.id }, data: { lastUsedAt: now } });
  return { id: user.id, email: user.email, name: user.name };
}
