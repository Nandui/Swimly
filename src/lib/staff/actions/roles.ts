"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  onUniqueViolation,
  type ActionResult,
} from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { guardKeyholders, withKeyholderLock } from "@/lib/staff/keyholders";
import { cleanLevels, describeLevels, roleColumns, type RoleLevels } from "@/lib/staff/levels";
import { legacyRoleFor, type RoleHome } from "@/lib/staff/permissions";
import { RESTRICTED_ROLE_REFUSAL } from "@/lib/staff/restricted";

/** Roles are the rules about the rules, so every action here needs
 *  `roles.manage` — including the one that hands `roles.manage` out.
 *
 *  **Nothing may leave the app without a keyholder.** Two permissions are
 *  load-bearing: `staff.manage`, without which no account can be created or
 *  fixed, and `roles.manage`, without which no permission can be granted back.
 *  Lose either across every active account and the only way in is a database
 *  console — the seed declines once an admin exists. `guardKeyholders` refuses
 *  any edit that would do it, by working out what the world would look like
 *  afterwards, including inherited administrator access and restricted roles
 *  that hold only one management permission. */

/** A role is a name, a home page name and one level for each module
 *  (docs/how-turnfin-works.md). Levels are translated into the permissions
 *  and screens the app checks by `roleColumns`, so every save writes the
 *  same translation. Unknown modules, levels and extras are dropped. */
const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the role a name.")
    .max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  homeName: z.string().trim().max(40, "Keep the home page name under 40 characters."),
  levels: z.record(z.string(), z.string()),
  extras: z.array(z.string()).max(20),
});

export type RoleInput = z.input<typeof roleSchema>;

/** Where a role's session starts until home pages replace role homes. */
function legacyHome(role: RoleLevels): RoleHome {
  return role.levels["pool-deck"] && !role.levels["swim-school"] ? "instructor" : "calendar";
}

function prepare(input: RoleInput) {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the role and try again." } as const;
  const role = cleanLevels(parsed.data.levels, parsed.data.extras);
  if (Object.keys(role.levels).length === 0) return { ok: false, error: "Give the role a level in at least one module, or nobody on it has anywhere to go." } as const;
  return { ok: true, data: parsed.data, role, columns: roleColumns(role), home: legacyHome(role) } as const;
}

export async function createRole(input: RoleInput): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const prepared = prepare(input);
  if (!prepared.ok) return fail(prepared.error);
  const { data: { name, description, homeName }, role, columns, home } = prepared;
  if (columns.restricted && !session.user.isSuperadmin) return fail(RESTRICTED_ROLE_REFUSAL);

  const last = await prisma.staffRole.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const created = await tx.staffRole.create({
        data: {
          name,
          description: description || null,
          homeName: homeName || null,
          home,
          ...columns,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true },
      });
      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "create",
        entity: "StaffRole",
        entityId: created.id,
        summary: `Created role ${created.name}: ${describeLevels(role)}`,
      }, tx);
      return created;
    }),
    `There is already a role called ${name}.`
  );
  if ("ok" in created) return created;

  revalidatePath("/roles");
  revalidatePath("/staff");
  revalidatePath("/");
  return ok();
}

export async function updateRole(id: string, input: RoleInput): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const prepared = prepare(input);
  if (!prepared.ok) return fail(prepared.error);
  const { data: { name, description, homeName }, role, columns, home } = prepared;

  const result = await onUniqueViolation(() => withKeyholderLock(async (tx) => {
    const existing = await tx.staffRole.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: true,
        screens: true,
        levels: true,
        extras: true,
        homeName: true,
        restricted: true,
      },
    });
    if (!existing) return fail("That role no longer exists.");
    if ((columns.restricted || existing.restricted) && !session.user.isSuperadmin) return fail(RESTRICTED_ROLE_REFUSAL);

    // A role still on screens and permissions switches to levels on its first
    // save; the log then states its levels in full.
    const changes: string[] = [];
    if (existing.levels === null) {
      changes.push(`switched to levels: ${describeLevels(role)}`);
    } else {
      const before = describeLevels(cleanLevels(existing.levels, existing.extras));
      if (before !== describeLevels(role)) changes.push(`${before} → ${describeLevels(role)}`);
    }
    if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
    if ((existing.description ?? "") !== description) changes.push("description");
    if ((existing.homeName ?? "") !== homeName) changes.push(homeName ? `home page "${homeName}"` : "home page name removed");

    if (changes.length === 0) return ok();
    const refusal = await guardKeyholders(
      { kind: "rolePermissions", roleId: id, permissions: columns.permissions, screens: columns.screens },
      tx
    );
    if (refusal) return fail(refusal);

    const updated = await tx.staffRole.update({
      where: { id },
      data: { name, description: description || null, homeName: homeName || null, home, ...columns },
      select: { id: true, name: true },
    });

    // The legacy enum on every holder is derived from the role, so it has to
    // move with it. Drop this with the column.
    await tx.user.updateMany({
      where: { staffRoleId: id },
      data: { role: legacyRoleFor(columns.permissions) },
    });

    if (changes.length > 0) {
      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "update",
        entity: "StaffRole",
        entityId: id,
        summary: `Updated role ${updated.name} (${changes.join("; ")})`,
      }, tx);
    }

    return ok();
  }), `There is already a role called ${name}.`);
  if (!result.ok) return result;

  revalidatePath("/roles");
  revalidatePath("/staff");
  revalidatePath("/");
  return ok();
}

/** Roles are deleted rather than archived: unlike a competency, a role
 *  explains nothing about the past. The audit log records what someone did,
 *  never which role let them, so removing one leaves no gap in the story. */
export async function deleteRole(id: string): Promise<ActionResult> {
  const session = await requirePermission("roles.manage");

  const result = await withKeyholderLock(async (tx) => {
    const existing = await tx.staffRole.findUnique({
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
        `${n} ${n === 1 ? "account is" : "accounts are"} on ${existing.name}. Move them to another role first.`
      );
    }

    await tx.staffRole.delete({ where: { id } });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "delete",
      entity: "StaffRole",
      entityId: id,
      summary: `Deleted role ${existing.name}`,
    }, tx);

    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/roles");
  revalidatePath("/staff");
  return ok();
}
