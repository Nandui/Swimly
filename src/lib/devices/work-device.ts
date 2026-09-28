import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";

/** Work is done on work PCs. A registered device (Staff → Work devices) is a
 *  work PC; anywhere else, signing in to Work needs the `work.anywhere`
 *  permission, which roles such as duty managers are given (administrators
 *  inherit it) — or the superadmin flag. Personal records are never on Work:
 *  staff use Turnfin Me on their own phone for those.
 *
 *  Off until WORK_DEVICE_REQUIRED=true, so turning it on waits until the
 *  centre's PCs are registered. */
export function workDeviceRequired(env: Record<string, string | undefined> = process.env) {
  return env.WORK_DEVICE_REQUIRED === "true";
}

/** Whether the person's role lets them work away from the centre's PCs:
 *  about the person, not a site. */
export async function mayWorkAnywhere(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true, staffRole: { select: { permissions: true } } },
  });
  if (!user) return false;
  if (user.isSuperadmin) return true;
  return expandPermissions(user.staffRole?.permissions ?? []).has("work.anywhere");
}
