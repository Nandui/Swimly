import { requirePermission, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** The roles, in the order an admin arranged them — which is least access
 *  first by default, so the powerful one is a deliberate reach rather than the
 *  thing the cursor lands on. */
export async function listRoles() {
  await requirePermission("roles.manage");

  return prisma.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      home: true,
      isSystem: true,
      sortOrder: true,
      _count: { select: { users: true } },
    },
  });
}

export type RoleRow = Awaited<ReturnType<typeof listRoles>>[number];

/** Just enough to fill the picker on the staff screen. Gated on
 *  `staff.manage` rather than `roles.manage`: assigning a role is not the same
 *  power as inventing one, and someone who may add people has to be able to
 *  see what they can be. */
export async function listRolesForPicker() {
  await requirePermission("staff.manage");

  return prisma.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, permissions: true },
  });
}

export type RoleOption = Awaited<ReturnType<typeof listRolesForPicker>>[number];

/** The signed-in person's own role, for the account page. No permission
 *  needed: it is their own. */
export async function getMyRole() {
  const session = await requireSession();

  return prisma.staffRole.findUnique({
    where: { id: session.user.roleId },
    select: { id: true, name: true, description: true, permissions: true },
  });
}
