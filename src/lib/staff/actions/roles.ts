"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  isUniqueViolation,
  ok,
  onUniqueViolation,
  type ActionResult,
} from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { guardKeyholders, withKeyholderLock } from "@/lib/staff/keyholders";
import {
  ALL_PERMISSIONS,
  ROLE_HOMES,
  isRoleHome,
  legacyRoleFor,
  type PermissionKey,
} from "@/lib/staff/permissions";

/** Roles are the rules about the rules, so every action here needs
 *  `roles.manage` — including the one that hands `roles.manage` out.
 *
 *  **Nothing may leave the app without a keyholder.** Two permissions are
 *  load-bearing: `staff.manage`, without which no account can be created or
 *  fixed, and `roles.manage`, without which no permission can be granted back.
 *  Lose either across every active account and the only way in is a database
 *  console — the seed declines once an admin exists. `guardKeyholders` refuses
 *  any edit that would do it, by working out what the world would look like
 *  afterwards rather than by counting admins, because with arbitrary roles
 *  there is no such thing as "an admin" any more. */

const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the role a name.")
    .max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  permissions: z.array(z.string()).max(100),
  /** A `ROLE_HOMES` key. Anything else lands on the overview. */
  home: z.string().transform((value) => (isRoleHome(value) ? value : "overview")),
});

/** The form's shape, before the schema normalises `home`. */
export type RoleInput = z.input<typeof roleSchema>;

/** Keys are filtered against the catalogue rather than validated as an enum:
 *  a form posting a key that no longer exists should drop it, not fail. */
function cleanPermissions(input: readonly string[]): PermissionKey[] {
  const known = new Set<string>(ALL_PERMISSIONS);
  return [...new Set(input.filter((key) => known.has(key)))] as PermissionKey[];
}

export async function createRole(input: RoleInput): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description, home } = parsed.data;
  const permissions = cleanPermissions(parsed.data.permissions);

  const last = await prisma.staffRole.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () =>
      prisma.staffRole.create({
        data: {
          name,
          description: description || null,
          permissions,
          home,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true },
      }),
    `There is already a role called ${name}.`
  );
  if ("ok" in created) return created;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "StaffRole",
    entityId: created.id,
    summary: `Created role ${created.name} with ${permissions.length} ${permissions.length === 1 ? "permission" : "permissions"}${permissions.length ? ` (${permissions.join(", ")})` : ""}`,
  });

  revalidatePath("/roles");
  revalidatePath("/staff");
  return ok();
}

export async function updateRole(id: string, input: RoleInput): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, description, home } = parsed.data;
  const permissions = cleanPermissions(parsed.data.permissions);

  const existing = await prisma.staffRole.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, permissions: true, home: true },
  });
  if (!existing) return fail("That role no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if ((existing.description ?? "") !== description) changes.push("description");
  if (existing.home !== home) changes.push(`starts on ${ROLE_HOMES[home].label}`);

  const before = new Set(existing.permissions);
  const after = new Set<string>(permissions);
  const granted = [...after].filter((key) => !before.has(key));
  const revoked = [...before].filter((key) => !after.has(key));
  if (granted.length) changes.push(`granted ${granted.join(", ")}`);
  if (revoked.length) changes.push(`revoked ${revoked.join(", ")}`);

  // The guard, the write and the legacy mirror share one transaction, and the
  // lock serialises them against any other role change. Checking first and
  // writing after would let two admins each strip the keys off the other's
  // role and both be told it was fine.
  let outcome: { refusal: string } | { updated: { id: string; name: string } };
  try {
    outcome = await withKeyholderLock(async (tx) => {
      const refusal = await guardKeyholders(
        { kind: "rolePermissions", roleId: id, permissions },
        tx
      );
      if (refusal) return { refusal };

      const updated = await tx.staffRole.update({
        where: { id },
        data: { name, description: description || null, permissions, home },
        select: { id: true, name: true },
      });

      // The legacy enum on every holder is derived from the role, so it has to
      // move with it. Drop this with the column.
      await tx.user.updateMany({
        where: { staffRoleId: id },
        data: { role: legacyRoleFor(permissions) },
      });

      return { updated };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return fail(`There is already a role called ${name}.`);
    throw err;
  }
  if ("refusal" in outcome) return fail(outcome.refusal);
  const updated = outcome.updated;

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "StaffRole",
      entityId: id,
      summary: `Updated role ${updated.name} (${changes.join("; ")})`,
    });
  }

  revalidatePath("/roles");
  revalidatePath("/staff");
  return ok();
}

/** Roles are deleted rather than archived: unlike a competency, a role
 *  explains nothing about the past. The audit log records what someone did,
 *  never which role let them, so removing one leaves no gap in the story. */
export async function deleteRole(id: string): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const existing = await prisma.staffRole.findUnique({
    where: { id },
    select: { id: true, name: true, isSystem: true, _count: { select: { users: true } } },
  });
  if (!existing) return fail("That role no longer exists.");

  if (existing.isSystem) {
    return fail(
      `${existing.name} is one of the roles the app shipped with. You can rename it and change what it may do, but not delete it.`
    );
  }
  if (existing._count.users > 0) {
    const n = existing._count.users;
    return fail(
      `${n} ${n === 1 ? "account is" : "accounts are"} on ${existing.name}. Move ${n === 1 ? "them" : "them"} to another role first.`
    );
  }

  await prisma.staffRole.delete({ where: { id } });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "delete",
    entity: "StaffRole",
    entityId: id,
    summary: `Deleted role ${existing.name}`,
  });

  revalidatePath("/roles");
  revalidatePath("/staff");
  return ok();
}
