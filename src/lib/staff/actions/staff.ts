"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
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
import { legacyRoleFor } from "@/lib/staff/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/staff/constants";

/** Accounts need `staff.manage`. Note that this is a different power from
 *  `roles.manage`: someone may be trusted to add a receptionist without being
 *  trusted to invent what a receptionist may do.
 *
 *  Two things are true of this file and of no other:
 *
 *  **The password never appears in a log.** Not in the audit summary, not in
 *  an error, not in a console line. The summary says a password was set and
 *  who set it, which is the answerable fact; the value is not.
 *
 *  **Nobody may be locked out.** Moving the last person who can manage
 *  accounts or roles onto a lesser role, or deactivating them, is refused by
 *  `guardKeyholders` — see `src/lib/staff/keyholders.ts`. */

const BCRYPT_ROUNDS = 12;

const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  // bcrypt reads the first 72 bytes and silently ignores the rest, so a longer
  // password would be quietly weaker than it looks. Refuse instead.
  .max(72, "Keep the password to 72 characters or fewer.");

const personSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give them a name.")
    .max(80, "Keep the name under 80 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email("That is not an email address.")
        .max(200, "Keep the email under 200 characters.")
    ),
  staffRoleId: z.string().min(1, "Pick a role."),
});

export type PersonInput = z.infer<typeof personSchema>;

/** The legacy enum is derived rather than chosen, so the column the previous
 *  release still reads stays truthful. Drop this with the column. */
async function roleFor(staffRoleId: string) {
  return prisma.staffRole.findUnique({
    where: { id: staffRoleId },
    select: { id: true, name: true, permissions: true },
  });
}

export async function createPerson(
  input: PersonInput & { password: string }
): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");

  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const password = passwordField.safeParse(input.password);
  if (!password.success) return fail(password.error.issues[0].message);

  const { name, email, staffRoleId } = parsed.data;
  const role = await roleFor(staffRoleId);
  if (!role) return fail("That role no longer exists.");

  const passwordHash = await bcrypt.hash(password.data, BCRYPT_ROUNDS);

  const created = await onUniqueViolation(
    () =>
      prisma.user.create({
        data: {
          name,
          email,
          staffRoleId: role.id,
          role: legacyRoleFor(role.permissions),
          passwordHash,
        },
        select: { id: true, name: true, email: true },
      }),
    `${email} already has an account.`
  );
  if ("ok" in created) return created;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "User",
    entityId: created.id,
    summary: `Added ${created.name} (${created.email}) as ${role.name}`,
  });

  revalidatePath("/staff");
  return ok();
}

export async function updatePerson(id: string, input: PersonInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");

  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, staffRoleId } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      staffRoleId: true,
      staffRole: { select: { name: true } },
    },
  });
  if (!existing) return fail("That account no longer exists.");

  const role = await roleFor(staffRoleId);
  if (!role) return fail("That role no longer exists.");

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if (existing.email !== email) changes.push(`email ${existing.email} → ${email}`);
  if (existing.staffRoleId !== role.id) {
    changes.push(`role ${existing.staffRole?.name ?? "none"} → ${role.name}`);
  }

  // The guard and the write share a transaction, and the lock serialises them
  // against any other role change. Checking first and writing after would let
  // two admins each move the other off the last role that holds the keys.
  let outcome: { refusal: string } | { updated: { id: string; name: string } };
  try {
    outcome = await withKeyholderLock(async (tx) => {
      if (existing.staffRoleId !== role.id) {
        const refusal = await guardKeyholders(
          { kind: "userRole", userId: id, roleId: role.id },
          tx
        );
        if (refusal) return { refusal };
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          name,
          email,
          staffRoleId: role.id,
          role: legacyRoleFor(role.permissions),
        },
        select: { id: true, name: true },
      });
      return { updated };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return fail(`${email} already has an account.`);
    throw err;
  }
  if ("refusal" in outcome) return fail(outcome.refusal);
  const updated = outcome.updated;

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "User",
      entityId: id,
      summary: `Updated ${updated.name} (${changes.join(", ")})`,
    });
  }

  revalidatePath("/staff");
  return ok();
}

/** Deactivate rather than delete: it is reversible, it keeps the audit trail
 *  readable, and `auth()` re-reads the account on every request, so access
 *  stops on the next page load rather than at token expiry. */
export async function setPersonActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!existing) return fail("That account no longer exists.");
  if (existing.isActive === active) return ok();

  if (!active && id === session.user.id) {
    return fail("You cannot deactivate your own account. Ask someone else to do it.");
  }

  const refusal = await withKeyholderLock(async (tx) => {
    if (!active) {
      const stop = await guardKeyholders({ kind: "deactivate", userId: id }, tx);
      if (stop) return stop;
    }
    await tx.user.update({ where: { id }, data: { isActive: active } });
    return null;
  });
  if (refusal) return fail(refusal);

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: active ? "restore" : "deactivate",
    entity: "User",
    entityId: id,
    summary: `${active ? "Reactivated" : "Deactivated"} ${existing.name} (${existing.email})`,
  });

  revalidatePath("/staff");
  return ok();
}

/** Someone with `staff.manage` setting another person's password, for a new
 *  starter or a person locked out. The value is hashed here and recorded
 *  nowhere. */
export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");

  const parsed = passwordField.safeParse(password);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!existing) return fail("That account no longer exists.");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(parsed.data, BCRYPT_ROUNDS) },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "update",
    entity: "User",
    entityId: id,
    summary: `Set a new password for ${existing.name} (${existing.email})`,
  });

  revalidatePath("/staff");
  return ok();
}
