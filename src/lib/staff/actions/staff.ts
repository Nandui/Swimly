"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD_LENGTH, ROLE_META } from "@/lib/staff/constants";

/** Accounts are the rules, not the data, so every action here is admin tier.
 *
 *  Two things are true of this file and of no other:
 *
 *  **The password never appears in a log.** Not in the audit summary, not in
 *  an error, not in a console line. The summary says a password was set and
 *  who set it, which is the answerable fact; the value is not.
 *
 *  **The last admin cannot be locked out.** Demoting or deactivating the only
 *  active admin would leave an app nobody can administer and no screen to fix
 *  it from — the seed declines to run once an admin exists, so the way back in
 *  would be a database console. `guardLastAdmin` is the whole defence, and it
 *  is a guard rather than a warning on purpose. */

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
  role: z.enum(["ADMIN", "INSTRUCTOR", "VIEWER"]),
});

export type PersonInput = z.infer<typeof personSchema>;

/** Refuses anything that would leave the app with no active admin. Returns a
 *  sentence to hand back, or null when the move is safe. */
async function guardLastAdmin(userId: string, verb: string): Promise<string | null> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, name: true },
  });
  if (!target || target.role !== "ADMIN" || !target.isActive) return null;

  const activeAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true },
  });
  if (activeAdmins > 1) return null;

  return `${target.name} is the only active admin. Make someone else an admin before you ${verb} this account, or there will be no way back in.`;
}

export async function createPerson(
  input: PersonInput & { password: string }
): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const password = passwordField.safeParse(input.password);
  if (!password.success) return fail(password.error.issues[0].message);

  const { name, email, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password.data, BCRYPT_ROUNDS);

  const created = await onUniqueViolation(
    () =>
      prisma.user.create({
        data: { name, email, role, passwordHash },
        select: { id: true, name: true, email: true, role: true },
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
    summary: `Added ${created.name} (${created.email}) as ${ROLE_META[created.role].label}`,
  });

  revalidatePath("/staff");
  return ok();
}

export async function updatePerson(id: string, input: PersonInput): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!existing) return fail("That account no longer exists.");

  if (existing.role === "ADMIN" && role !== "ADMIN") {
    const refusal = await guardLastAdmin(id, "change the role on");
    if (refusal) return fail(refusal);
  }

  const changes: string[] = [];
  if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
  if (existing.email !== email) changes.push(`email ${existing.email} → ${email}`);
  if (existing.role !== role) {
    changes.push(`role ${ROLE_META[existing.role].label} → ${ROLE_META[role].label}`);
  }

  const updated = await onUniqueViolation(
    () =>
      prisma.user.update({
        where: { id },
        data: { name, email, role },
        select: { id: true, name: true },
      }),
    `${email} already has an account.`
  );
  if ("ok" in updated) return updated;

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
  const session = await requireAdmin();

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!existing) return fail("That account no longer exists.");
  if (existing.isActive === active) return ok();

  if (!active) {
    if (id === session.user.id) {
      return fail("You cannot deactivate your own account. Ask another admin to do it.");
    }
    const refusal = await guardLastAdmin(id, "deactivate");
    if (refusal) return fail(refusal);
  }

  await prisma.user.update({ where: { id }, data: { isActive: active } });

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

/** An admin setting someone else's password, for a new starter or a person
 *  locked out. The value is hashed here and recorded nowhere. */
export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const session = await requireAdmin();

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
