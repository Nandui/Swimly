"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { guardKeyholders, withKeyholderLock } from "@/lib/staff/keyholders";
import { legacyRoleFor } from "@/lib/staff/permissions";
import { BCRYPT_ROUNDS, passwordSchema } from "@/lib/staff/passwords";

/** Account changes require staff.manage. Password values never enter an audit
 *  row; role changes and deactivation preserve the last reachable keyholder. */
const personSchema = z.object({
  name: z.string().trim().min(1, "Give them a name.").max(80, "Keep the name under 80 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("That is not an email address.").max(200, "Keep the email under 200 characters.")),
  staffRoleId: z.string().min(1, "Pick a role."),
});
export type PersonInput = z.infer<typeof personSchema>;

export async function createPerson(input: PersonInput & { password: string }): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return fail(password.error.issues[0].message);
  const { name, email, staffRoleId } = parsed.data;
  // Hash before holding a pool connection or a lock.
  const passwordHash = await bcrypt.hash(password.data, BCRYPT_ROUNDS);
  const result = await onUniqueViolation(() => withKeyholderLock(async (tx) => {
    const role = await tx.staffRole.findUnique({ where: { id: staffRoleId }, select: { id: true, name: true, permissions: true } });
    if (!role) return fail("That role no longer exists.");
    const created = await tx.user.create({
      data: { name, email, staffRoleId: role.id, role: legacyRoleFor(role.permissions), passwordHash },
      select: { id: true, name: true, email: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "create",
      entity: "User", entityId: created.id,
      summary: `Added ${created.name} (${created.email}) as ${role.name}`,
    }, tx);
    return ok();
  }), `${email} already has an account.`);
  if (result.ok) revalidatePath("/staff");
  return result;
}

export async function updatePerson(id: string, input: PersonInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, staffRoleId } = parsed.data;
  const result = await onUniqueViolation(() => withKeyholderLock(async (tx) => {
    const [existing, role] = await Promise.all([
      tx.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, staffRoleId: true, staffRole: { select: { name: true } } } }),
      tx.staffRole.findUnique({ where: { id: staffRoleId }, select: { id: true, name: true, permissions: true } }),
    ]);
    if (!existing) return fail("That account no longer exists.");
    if (!role) return fail("That role no longer exists.");
    const changes: string[] = [];
    if (existing.name !== name) changes.push(`name ${existing.name} → ${name}`);
    if (existing.email !== email) changes.push(`email ${existing.email} → ${email}`);
    if (existing.staffRoleId !== role.id) {
      changes.push(`role ${existing.staffRole?.name ?? "none"} → ${role.name}`);
      const refusal = await guardKeyholders({ kind: "userRole", userId: id, roleId: role.id }, tx);
      if (refusal) return fail(refusal);
    }
    if (changes.length === 0) return ok();
    const updated = await tx.user.update({
      where: { id }, data: { name, email, staffRoleId: role.id, role: legacyRoleFor(role.permissions) },
      select: { id: true, name: true },
    });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "update",
      entity: "User", entityId: id, summary: `Updated ${updated.name} (${changes.join(", ")})`,
    }, tx);
    return ok();
  }), `${email} already has an account.`);
  if (result.ok) revalidatePath("/staff");
  return result;
}

export async function setPersonActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  if (typeof active !== "boolean") return fail("Choose whether the account is active.");
  if (!active && id === session.user.id) return fail("You cannot deactivate your own account. Ask someone else to do it.");
  const result = await withKeyholderLock(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, isActive: true } });
    if (!existing) return fail("That account no longer exists.");
    if (existing.isActive === active) return ok();
    if (!active) {
      const refusal = await guardKeyholders({ kind: "deactivate", userId: id }, tx);
      if (refusal) return fail(refusal);
    }
    await tx.user.update({ where: { id }, data: { isActive: active } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown",
      action: active ? "restore" : "deactivate", entity: "User", entityId: id,
      summary: `${active ? "Reactivated" : "Deactivated"} ${existing.name} (${existing.email})`,
    }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/staff");
  return result;
}

export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const passwordHash = await bcrypt.hash(parsed.data, BCRYPT_ROUNDS);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
    if (!existing) return fail("That account no longer exists.");
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "update",
      entity: "User", entityId: id, summary: `Set a new password for ${existing.name} (${existing.email})`,
    }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/staff");
  return result;
}
