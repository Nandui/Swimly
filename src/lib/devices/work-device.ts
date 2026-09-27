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

/** Every permission the person holds through any of their roles, whatever the
 *  scope: working from any device is about the person, not a site. */
export async function mayWorkAnywhere(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true, staffRole: { select: { permissions: true } }, roleAssignments: { select: { role: { select: { permissions: true } } } } },
  });
  if (!user) return false;
  if (user.isSuperadmin) return true;
  // Each role expands on its own, so an administrator role keeps its inheritance.
  return [user.staffRole?.permissions ?? [], ...user.roleAssignments.map((a) => a.role.permissions)]
    .some((permissions) => expandPermissions(permissions).has("work.anywhere"));
}
