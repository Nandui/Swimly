import { prisma } from "@/lib/prisma";
import { staffApiConfig } from "@/lib/staff-api/config";
import { sendStaffReminder } from "@/lib/staff-api/email";

/** Turnfin Me's settings, or null while it is switched off or misconfigured. */
export function meSettings() {
  try { return staffApiConfig(); } catch { return null; }
}

/** A shift was added, changed or cancelled for this person. Best effort: a
 *  mail problem never undoes the rota change. Core, so Rota can call it
 *  without importing the daily digest, which reads every module. */
export async function notifyShiftChange(userId: string | null, line: string) {
  if (!userId) return;
  const config = meSettings();
  if (!config?.meUrl) return;
  try {
    const [user, pref] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } }),
      prisma.staffNotificationPreference.findUnique({ where: { userId } }),
    ]);
    if (!user?.isActive || pref?.shiftChanges === false) return;
    await sendStaffReminder(user.email, "Your shifts changed", line, `${config.meUrl}/shifts`);
  } catch {
    // Best effort.
  }
}
