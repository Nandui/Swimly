import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { expandPermissions, permissionMeta, type PermissionKey } from "@/lib/staff/permissions";

/** Nothing may leave the app without a keyholder.
 *
 *  Two permissions are load-bearing: `staff.manage`, without which no account
 *  can be created or fixed, and `roles.manage`, without which no permission
 *  can be granted back. Lose either across every active account and the only
 *  way in is a database console — `prisma/seed.ts` declines once an admin
 *  exists.
 *
 *  **Counting again is not enough.** Two admins, each moving the other off the
 *  last role that holds the keys, would both read "one holder would remain"
 *  and both commit. It is the same shape as the capacity race that
 *  `withCourseSeat` exists to solve, and it has a worse outcome: nobody can
 *  get back in to undo it. So the guard and the write share a transaction, and
 *  `withKeyholderLock` takes row locks first.
 *
 *  Deliberately **not** in a `"use server"` file. Every export from one of
 *  those becomes an endpoint the browser can call, and `activeHoldersOf` takes
 *  no permission of its own: as an action it would answer "how many people can
 *  manage accounts?" to anybody who asked. */

const KEY_PERMISSIONS: PermissionKey[] = ["staff.manage", "roles.manage"];

type Db = Prisma.TransactionClient | typeof prisma;

/** A change, described before it happens. The interesting cases are indirect —
 *  taking a permission off a role three people share, or moving the last
 *  person who holds it — so the guard works from what the world *would* look
 *  like rather than from the edit itself. */
export type Simulation =
  | { kind: "rolePermissions"; roleId: string; permissions: string[] }
  | { kind: "userRole"; userId: string; roleId: string }
  | { kind: "deactivate"; userId: string };

export async function activeHoldersOf(
  permission: PermissionKey,
  sim: Simulation,
  db: Db = prisma
): Promise<number> {
  const [users, roles] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, select: { id: true, staffRoleId: true } }),
    db.staffRole.findMany({ select: { id: true, permissions: true } }),
  ]);

  const permissionsByRole = new Map(roles.map((role) => [role.id, role.permissions]));
  if (sim.kind === "rolePermissions") permissionsByRole.set(sim.roleId, sim.permissions);

  return users.filter((user) => {
    if (sim.kind === "deactivate" && user.id === sim.userId) return false;
    const roleId =
      sim.kind === "userRole" && user.id === sim.userId ? sim.roleId : user.staffRoleId;
    if (!roleId) return false;
    return expandPermissions(permissionsByRole.get(roleId) ?? []).has(permission);
  }).length;
}

/** Returns a sentence to hand back, or null when the change is safe.
 *
 *  Pass the transaction client whenever the answer is about to be acted on —
 *  otherwise it reads committed state and cannot see the change the same
 *  transaction has already made. */
export async function guardKeyholders(sim: Simulation, db: Db = prisma): Promise<string | null> {
  for (const permission of KEY_PERMISSIONS) {
    if ((await activeHoldersOf(permission, sim, db)) === 0) {
      return `That would leave nobody able to ${permissionMeta(permission).label.toLowerCase()}. Give that to someone else first, or there will be no way back in.`;
    }
  }
  return null;
}

/** Serialises every change that could remove the last keyholder.
 *
 *  `FOR UPDATE` over the active accounts is the whole mechanism: two
 *  concurrent role changes queue instead of interleaving, so the second one
 *  reads the first one's result and is refused. The set is tens of rows in a
 *  swim club, and this runs only when somebody edits a role or an account. */
export async function withKeyholderLock<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "isActive" = true FOR UPDATE`;
    return run(tx);
  });
}
