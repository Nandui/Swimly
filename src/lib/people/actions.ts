"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireSession, can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { guardKeyholders, guardSuperadmins, withKeyholderLock } from "@/lib/staff/keyholders";
import { hasAdministratorAccess } from "@/lib/staff/permissions";
import { RESTRICTED_ROLE_REFUSAL } from "@/lib/staff/restricted";
import { requireCapFor } from "@/lib/policy/session";
import { isScopeKind } from "@/lib/policy/types";

/** The People core: one person record and one organisation chart that every
 *  module reads. Structure (departments, managers, extra roles) is account
 *  administration, so it needs `staff.manage`. Qualifications are recorded by
 *  whoever holds `qualifications.manage` for that person's scope. Every change
 *  is audited in the same transaction. */

const revalidate = (userId?: string) => { revalidatePath("/staff"); revalidatePath("/staff/organisation"); if (userId) revalidatePath(`/staff/${userId}`); };
const actorName = (session: { user: { name?: string | null } }) => session.user.name ?? "Unknown";
const optionalId = z.string().trim().max(64).transform((v) => v || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.");

// ---------------------------------------------------------------------------
// Profile: job title, start date, primary site, manager, departments
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  jobTitle: z.string().trim().max(80, "Keep the job title under 80 characters."),
  startedOn: z.union([isoDate, z.literal("")]),
  primaryClubId: optionalId,
  managerId: optionalId,
  departmentIds: z.array(z.string().min(1)).max(20),
  primaryDepartmentId: optionalId,
});
export type ProfileInput = z.input<typeof profileSchema>;

/** Would setting `managerId` as this person's manager create a loop? */
async function createsCycle(tx: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string, managerId: string) {
  let current: string | null = managerId;
  for (let depth = 0; current && depth < 50; depth++) {
    if (current === userId) return true;
    current = (await tx.user.findUnique({ where: { id: current }, select: { managerId: true } }))?.managerId ?? null;
  }
  return false;
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { jobTitle, startedOn, primaryClubId, managerId, departmentIds, primaryDepartmentId } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, orgId: true } });
    if (!person) return fail("That account no longer exists.");
    if (managerId) {
      if (managerId === userId) return fail("Someone cannot be their own manager.");
      const manager = await tx.user.findUnique({ where: { id: managerId }, select: { orgId: true } });
      if (!manager || manager.orgId !== person.orgId) return fail("Choose a manager from the same organisation.");
      if (await createsCycle(tx, userId, managerId)) return fail("That would make a loop: this person already manages their chosen manager.");
    }
    if (primaryClubId && !(await tx.club.findFirst({ where: { id: primaryClubId, orgId: person.orgId } }))) return fail("Choose one of your sites.");
    const departments = await tx.department.findMany({ where: { id: { in: departmentIds }, orgId: person.orgId ?? undefined, archivedAt: null }, select: { id: true } });
    if (departments.length !== new Set(departmentIds).size) return fail("One of those departments no longer exists.");
    if (primaryDepartmentId && !departmentIds.includes(primaryDepartmentId)) return fail("The main department must be one of theirs.");
    await tx.user.update({ where: { id: userId }, data: { jobTitle: jobTitle || null, startedOn: startedOn ? new Date(`${startedOn}T00:00:00Z`) : null, primaryClubId, managerId } });
    await tx.userDepartment.deleteMany({ where: { userId } });
    if (departmentIds.length) {
      await tx.userDepartment.createMany({ data: [...new Set(departmentIds)].map((departmentId) => ({ userId, departmentId, isPrimary: departmentId === (primaryDepartmentId ?? departmentIds[0]) })) });
    }
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "User", entityId: userId, summary: `Updated ${person.name}'s profile (job, site, manager, departments)` }, tx);
    return ok();
  });
  if (result.ok) revalidate(userId);
  return result;
}

// ---------------------------------------------------------------------------
// Additional roles: role × where it applies
// ---------------------------------------------------------------------------

const assignmentSchema = z.object({
  roleId: z.string().min(1, "Pick a role."),
  scopeKind: z.string().refine(isScopeKind, "Choose where the role applies."),
  scopeId: z.string().max(64).default(""),
});
export type AssignmentInput = z.input<typeof assignmentSchema>;

export async function addAssignment(userId: string, input: AssignmentInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { roleId, scopeKind } = parsed.data;
  const scopeId = scopeKind === "site" || scopeKind === "department" ? parsed.data.scopeId : "";
  if ((scopeKind === "site" || scopeKind === "department") && !scopeId) return fail(scopeKind === "site" ? "Choose the site." : "Choose the department.");
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    const [person, role] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, orgId: true, staffRoleId: true } }),
      tx.staffRole.findUnique({ where: { id: roleId }, select: { id: true, name: true, permissions: true, restricted: true } }),
    ]);
    if (!person?.orgId) return fail("That account no longer exists.");
    if (!role) return fail("That role no longer exists.");
    if (role.restricted && !session.user.isSuperadmin) return fail(RESTRICTED_ROLE_REFUSAL);
    // Account and role administration is organisation-wide by nature.
    if (hasAdministratorAccess(role.permissions) && scopeKind !== "all") return fail("An administrator role applies everywhere; it cannot be limited to a site, department or team.");
    if (role.id === person.staffRoleId && scopeKind === "all") return fail(`${role.name} is already their main role.`);
    let where = "everywhere";
    if (scopeKind === "site") {
      const club = await tx.club.findFirst({ where: { id: scopeId, orgId: person.orgId }, select: { name: true } });
      if (!club) return fail("That site no longer exists.");
      where = `at ${club.name}`;
    }
    if (scopeKind === "department") {
      const department = await tx.department.findFirst({ where: { id: scopeId, orgId: person.orgId, archivedAt: null }, select: { name: true } });
      if (!department) return fail("That department no longer exists.");
      where = `for ${department.name}`;
    }
    if (scopeKind === "reports") where = "for their own team";
    const created = await tx.roleAssignment.create({ data: { orgId: person.orgId, userId, roleId, scopeKind, scopeId, grantedById: session.user.id } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "assign-role", entity: "RoleAssignment", entityId: created.id, summary: `Gave ${person.name} the ${role.name} role ${where}` }, tx);
    return ok();
  }), "They already have that role there.");
  if (result.ok) revalidate(userId);
  return result;
}

/** The sites a person works at, where their role's Swim school, Training and
 *  Rota levels apply (docs/how-turnfin-works.md). No sites means every site,
 *  which is how everyone worked before. */
export async function setWorksAt(userId: string, siteIds: string[]): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = z.array(z.string().min(1).max(64)).max(50).safeParse(siteIds);
  if (!parsed.success) return fail("Choose from your sites.");
  const wanted = [...new Set(parsed.data)];
  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { name: true, orgId: true, siteIds: true } });
    if (!person) return fail("That person no longer exists.");
    const sites = await tx.club.findMany({ where: { id: { in: wanted }, orgId: person.orgId, archivedAt: null }, select: { id: true, name: true } });
    if (sites.length !== wanted.length) return fail("Choose from your sites.");
    const ordered = wanted.slice().sort();
    if (ordered.join() === [...person.siteIds].sort().join()) return ok();
    await tx.user.update({ where: { id: userId }, data: { siteIds: ordered } });
    const where = sites.length ? sites.map((s) => s.name).sort().join(", ") : "every site";
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "User", entityId: userId, clubId: null, summary: `${person.name} now works at ${where}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(userId);
  return result;
}

export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const result = await withKeyholderLock(async (tx) => {
    const assignment = await tx.roleAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, userId: true, user: { select: { name: true } }, role: { select: { name: true, restricted: true } } } });
    if (!assignment) return ok();
    if (assignment.role.restricted && !session.user.isSuperadmin) return fail(RESTRICTED_ROLE_REFUSAL);
    const refusal = await guardKeyholders({ kind: "removeAssignment", assignmentId }, tx);
    if (refusal) return fail(refusal);
    await tx.roleAssignment.delete({ where: { id: assignmentId } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "unassign-role", entity: "RoleAssignment", entityId: assignmentId, summary: `Removed the ${assignment.role.name} role from ${assignment.user.name}` }, tx);
    return ok();
  });
  revalidate();
  return result;
}

// ---------------------------------------------------------------------------
// Superadmin: only a superadmin makes or unmakes one
// ---------------------------------------------------------------------------

export async function setSuperadmin(userId: string, value: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.user.isSuperadmin) return fail("Only a superadmin can change who is a superadmin.");
  if (typeof value !== "boolean") return fail("Choose yes or no.");
  const result = await withKeyholderLock(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { name: true, isSuperadmin: true, isActive: true, orgId: true } });
    if (!person) return fail("That account no longer exists.");
    if (person.orgId !== session.user.orgId) return fail("That account belongs to another organisation.");
    if (person.isSuperadmin === value) return ok();
    if (value && !person.isActive) return fail("Reactivate the account first.");
    const refusal = await guardSuperadmins({ kind: "superadmin", userId, value }, tx);
    if (refusal) return fail(refusal);
    await tx.user.update({ where: { id: userId }, data: { isSuperadmin: value } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: value ? "grant-superadmin" : "revoke-superadmin", entity: "User", entityId: userId, summary: `${value ? "Made" : "Removed"} ${person.name} ${value ? "a superadmin" : "as a superadmin"}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(userId);
  return result;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const departmentSchema = z.object({
  name: z.string().trim().min(1, "Name the department.").max(60, "Keep the name under 60 characters."),
  clubId: optionalId,
});
export type DepartmentInput = z.input<typeof departmentSchema>;

async function orgOf(userId: string) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } }))?.orgId ?? null;
}

export async function saveDepartment(id: string | null, input: DepartmentInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const orgId = await orgOf(session.user.id);
  if (!orgId) return fail("Your account has no organisation.");
  const { name, clubId } = parsed.data;
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    if (clubId && !(await tx.club.findFirst({ where: { id: clubId, orgId } }))) return fail("Choose one of your sites.");
    if (id) {
      const existing = await tx.department.findFirst({ where: { id, orgId }, select: { name: true } });
      if (!existing) return fail("That department no longer exists.");
      await tx.department.update({ where: { id }, data: { name, clubId } });
      await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "Department", entityId: id, summary: existing.name === name ? `Updated department ${name}` : `Renamed department ${existing.name} → ${name}` }, tx);
    } else {
      const last = await tx.department.findFirst({ where: { orgId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const created = await tx.department.create({ data: { orgId, name, clubId, sortOrder: (last?.sortOrder ?? -1) + 1 } });
      await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "create", entity: "Department", entityId: created.id, summary: `Created department ${name}` }, tx);
    }
    return ok();
  }), "There is already a department with that name.");
  if (result.ok) revalidate();
  return result;
}

export async function setDepartmentArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const orgId = await orgOf(session.user.id);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.department.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { name: true, archivedAt: true, _count: { select: { members: true } } } });
    if (!existing) return fail("That department no longer exists.");
    if (!!existing.archivedAt === archived) return ok();
    if (archived && existing._count.members > 0) return fail(`Move the ${existing._count.members} people in ${existing.name} first; their access may depend on it.`);
    if (archived && (await tx.roleAssignment.count({ where: { scopeKind: "department", scopeId: id } })) > 0) return fail(`Some roles are given for ${existing.name}. Remove those first.`);
    await tx.department.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: archived ? "archive" : "restore", entity: "Department", entityId: id, summary: `${archived ? "Archived" : "Restored"} department ${existing.name}` }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

// ---------------------------------------------------------------------------
// Qualification types and records
// ---------------------------------------------------------------------------

const typeSchema = z.object({
  name: z.string().trim().min(1, "Name the qualification.").max(80, "Keep the name under 80 characters."),
  validityMonths: z.union([z.coerce.number().int().min(1, "At least one month.").max(240, "At most 20 years."), z.literal("").transform(() => null), z.null()]),
});
export type QualificationTypeInput = z.input<typeof typeSchema>;

export async function saveQualificationType(id: string | null, input: QualificationTypeInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const orgId = await orgOf(session.user.id);
  if (!orgId) return fail("Your account has no organisation.");
  const { name, validityMonths } = parsed.data;
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.qualificationType.findFirst({ where: { id, orgId }, select: { name: true } });
      if (!existing) return fail("That qualification no longer exists.");
      await tx.qualificationType.update({ where: { id }, data: { name, validityMonths } });
      await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "QualificationType", entityId: id, summary: `Updated qualification type ${name}` }, tx);
    } else {
      const created = await tx.qualificationType.create({ data: { orgId, name, validityMonths } });
      await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "create", entity: "QualificationType", entityId: created.id, summary: `Created qualification type ${name}` }, tx);
    }
    return ok();
  }), "There is already a qualification with that name.");
  if (result.ok) revalidate();
  return result;
}

export async function setQualificationTypeArchived(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const orgId = await orgOf(session.user.id);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.qualificationType.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { name: true, archivedAt: true } });
    if (!existing) return fail("That qualification no longer exists.");
    if (!!existing.archivedAt === archived) return ok();
    await tx.qualificationType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: archived ? "archive" : "restore", entity: "QualificationType", entityId: id, summary: `${archived ? "Archived" : "Restored"} qualification type ${existing.name}` }, tx);
    return ok();
  });
  if (result.ok) revalidate();
  return result;
}

const qualificationSchema = z.object({
  typeId: z.string().min(1, "Choose the qualification."),
  issuedOn: isoDate,
  expiresOn: z.union([isoDate, z.literal("")]),
  reference: z.string().trim().max(80, "Keep the reference under 80 characters."),
  note: z.string().trim().max(500, "Keep the note under 500 characters."),
});
export type QualificationInput = z.input<typeof qualificationSchema>;

/** Recording a qualification is scoped: `qualifications.manage` for this
 *  person (org-wide, their site, their department or their manager), or
 *  account administration. It is marked verified by whoever records it. */
async function requireQualificationAccess(userId: string) {
  const session = await requireSession();
  if (can(session, "staff.manage")) return session;
  await requireCapFor("qualifications.manage", { subjectUserId: userId, orgId: session.user.orgId ?? null });
  return session;
}

export async function recordQualification(userId: string, input: QualificationInput): Promise<ActionResult> {
  const session = await requireQualificationAccess(userId);
  const parsed = qualificationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { typeId, issuedOn, expiresOn, reference, note } = parsed.data;
  if (expiresOn && expiresOn < issuedOn) return fail("The expiry date is before the issue date.");
  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { name: true, orgId: true } });
    if (!person?.orgId) return fail("That account no longer exists.");
    const type = await tx.qualificationType.findFirst({ where: { id: typeId, orgId: person.orgId, archivedAt: null }, select: { name: true } });
    if (!type) return fail("That qualification is no longer offered.");
    const created = await tx.qualification.create({ data: {
      orgId: person.orgId, userId, typeId, issuedOn: new Date(`${issuedOn}T00:00:00Z`), expiresOn: expiresOn ? new Date(`${expiresOn}T00:00:00Z`) : null,
      reference, note, verifiedById: session.user.id, verifiedAt: new Date(),
    } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "record-qualification", entity: "Qualification", entityId: created.id, summary: `Recorded ${type.name} for ${person.name}${expiresOn ? `, valid until ${expiresOn}` : ""}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(userId);
  return result;
}

export async function revokeQualification(qualificationId: string, reason: string): Promise<ActionResult> {
  const trimmed = String(reason ?? "").trim();
  if (trimmed.length < 3 || trimmed.length > 300) return fail("Say briefly why it is being withdrawn.");
  const existing = await prisma.qualification.findUnique({ where: { id: qualificationId }, select: { userId: true } });
  if (!existing) return fail("That qualification no longer exists.");
  const session = await requireQualificationAccess(existing.userId);
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.qualification.findUnique({ where: { id: qualificationId }, select: { revokedAt: true, user: { select: { name: true } }, type: { select: { name: true } } } });
    if (!current) return fail("That qualification no longer exists.");
    if (current.revokedAt) return ok();
    await tx.qualification.update({ where: { id: qualificationId }, data: { revokedAt: new Date() } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "revoke-qualification", entity: "Qualification", entityId: qualificationId, summary: `Withdrew ${current.type.name} for ${current.user.name}: ${trimmed}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(existing.userId);
  return result;
}
