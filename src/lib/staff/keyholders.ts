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

/** The two key permissions. Each also opens its page (Staff, Roles). */
const KEYS: PermissionKey[] = ["staff.manage", "roles.manage"];

type Db = Prisma.TransactionClient | typeof prisma;

/** A change, described before it happens. The interesting cases are indirect —
 *  taking a permission off a role three people share, or moving the last
 *  person who holds it — so the guard works from what the world *would* look
 *  like rather than from the edit itself. */
export type Simulation =
  | { kind: "rolePermissions"; roleId: string; permissions: string[] }
  | { kind: "userRole"; userId: string; roleId: string }
  | { kind: "deactivate"; userId: string }
  | { kind: "superadmin"; userId: string; value: boolean };

/** Load once for all key checks, and expand each shared role once. */
async function simulatedHolders(sim: Simulation, db: Db) {
  const [users, roles] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, select: { id: true, staffRoleId: true } }),
    db.staffRole.findMany({ select: { id: true, permissions: true } }),
  ]);

  const byRole = new Map(roles.map((role) => [role.id, role.permissions]));
  if (sim.kind === "rolePermissions") byRole.set(sim.roleId, sim.permissions);
  const accessByRole = new Map([...byRole].map(([id, permissions]) => [id, expandPermissions(permissions)] as const));
  return users.flatMap((user) => {
    if (sim.kind === "deactivate" && user.id === sim.userId) return [];
    const roleId =
      sim.kind === "userRole" && user.id === sim.userId ? sim.roleId : user.staffRoleId;
    // One role each (docs/how-turnfin-works.md).
    const held = roleId ? accessByRole.get(roleId) : undefined;
    return held ? [held] : [];
  });
}

/** Active accounts that would hold the permission. */
export async function activeHoldersOf(permission: PermissionKey, sim: Simulation, db: Db = prisma): Promise<number> {
  return (await simulatedHolders(sim, db)).filter((held) => held.has(permission)).length;
}

/** Returns a sentence to hand back, or null when the change is safe.
 *
 *  Pass the transaction client whenever the answer is about to be acted on —
 *  otherwise it reads committed state and cannot see the change the same
 *  transaction has already made. */
export async function guardKeyholders(sim: Simulation, db: Db = prisma): Promise<string | null> {
  const holders = await simulatedHolders(sim, db);
  for (const key of KEYS) {
    if (!holders.some((held) => held.has(key))) {
      return `That would leave nobody able to ${permissionMeta(key).label.toLowerCase()}. Give that to someone else first, or there will be no way back in.`;
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
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "isActive" = true ORDER BY "id" FOR UPDATE`;
    return run(tx);
  });
}

/** The last active superadmin cannot be removed or deactivated: restricted
 *  data (HR) would then be reachable by nobody, and only a superadmin can
 *  make another. Before the first superadmin exists there is nothing to keep. */
export async function guardSuperadmins(sim: Simulation, db: Db = prisma): Promise<string | null> {
  const current = await db.user.findMany({ where: { isActive: true, isSuperadmin: true }, select: { id: true } });
  if (current.length === 0) return null;
  const remaining = current.filter((user) => {
    if (sim.kind === "deactivate" && sim.userId === user.id) return false;
    if (sim.kind === "superadmin" && sim.userId === user.id && !sim.value) return false;
    return true;
  });
  return remaining.length === 0
    ? "That would leave no active superadmin, and only a superadmin can make another. Make someone else a superadmin first."
    : null;
}
