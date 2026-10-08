"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONTRACT_TYPES } from "@/lib/people/constants";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireSession, can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { guardSuperadmins, withKeyholderLock } from "@/lib/staff/keyholders";
import { requireCapFor } from "@/lib/policy/session";

/** The People core: one person record and one organisation chart that every
 *  module reads. Structure (departments, managers, where people work) is account
 *  administration, so it needs `staff.manage`. Qualifications are recorded by
 *  whoever holds `qualifications.manage` for that person's scope. Every change
 *  is audited in the same transaction. */

const revalidate = (userId?: string) => { revalidatePath("/staff"); if (userId) revalidatePath(`/hr/people/${userId}`); revalidatePath("/departments"); revalidatePath("/qualifications"); if (userId) revalidatePath(`/staff/${userId}`); };
const actorName = (session: { user: { name?: string | null } }) => session.user.name ?? "Unknown";
const optionalId = z.string().trim().max(64).transform((v) => v || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.");

// ---------------------------------------------------------------------------
// Profile: job title, start date, primary site, manager, departments
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  /** Their position (Admin, Positions); their job title follows its name. */
  positionId: optionalId,
  startedOn: z.union([isoDate, z.literal("")]),
  /** Optional; only an age band on a day reaches the rota (under-18s' breaks). */
  dateOfBirth: z.union([isoDate, z.literal("")]).default(""),
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
  const { positionId, startedOn, dateOfBirth, primaryClubId, managerId, departmentIds, primaryDepartmentId } = parsed.data;
  if (dateOfBirth && (dateOfBirth > new Date().toISOString().slice(0, 10) || dateOfBirth < "1920-01-01")) return fail("Check the date of birth.");
  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, orgId: true, positionId: true, jobTitle: true } });
    if (!person) return fail("That account no longer exists.");
    // A position from Admin's list; an archived one stays only for whoever already holds it.
    const position = positionId ? await tx.position.findFirst({ where: { id: positionId, orgId: person.orgId ?? undefined, OR: [{ archivedAt: null }, { id: person.positionId ?? "" }] }, select: { name: true } }) : null;
    if (positionId && !position) return fail("Choose one of the positions.");
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
    await tx.user.update({ where: { id: userId }, data: { positionId, jobTitle: position ? position.name : positionId === null && person.positionId ? null : person.jobTitle, startedOn: startedOn ? new Date(`${startedOn}T00:00:00Z`) : null, dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00Z`) : null, primaryClubId, managerId } });
    await tx.userDepartment.deleteMany({ where: { userId } });
    if (departmentIds.length) {
      await tx.userDepartment.createMany({ data: [...new Set(departmentIds)].map((departmentId) => ({ userId, departmentId, isPrimary: departmentId === (primaryDepartmentId ?? departmentIds[0]) })) });
    }
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "User", entityId: userId, summary: `Updated ${person.name}'s profile (position${position ? ` ${position.name}` : ""}, site, manager, departments)` }, tx);
    return ok();
  });
  if (result.ok) revalidate(userId);
  return result;
}

// ---------------------------------------------------------------------------
// Where they work
// ---------------------------------------------------------------------------

/** The sites a person works at, where their role's Swim school, Training and
 *  Rota levels apply (docs/how-turnfin-works.md). No sites means every site,
 *  which is how everyone worked before. */
const employmentSchema = z.object({
  contractType: z.union([z.enum(CONTRACT_TYPES), z.literal("")]).transform((v) => v || null),
  /** Hours a week, e.g. "37.5"; empty when not set. */
  contractHours: z.string().trim().refine((v) => v === "" || (/^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) <= 80), "Give the hours a week as a number up to 80, like 37.5.").transform((v) => (v ? Math.round(Number(v) * 60) : null)),
  endedOn: z.union([isoDate, z.literal("")]).transform((v) => v || null),
  payrollNumber: z.string().trim().max(40, "Keep the payroll number under 40 characters.").transform((v) => v || null),
});
export type EmploymentInput = z.input<typeof employmentSchema>;

/** How someone is employed: contract, hours a week, their last day and payroll's number. */
export async function updateEmployment(userId: string, input: EmploymentInput): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  const parsed = employmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const person = await prisma.user.findFirst({ where: { id: userId, orgId: session.user.orgId ?? undefined }, select: { name: true, startedOn: true } });
  if (!person) return fail("That account no longer exists.");
  if (data.endedOn && person.startedOn && data.endedOn < person.startedOn.toISOString().slice(0, 10)) return fail("Their last day can't be before they started.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { contractType: data.contractType, contractMinutes: data.contractHours, endedOn: data.endedOn ? new Date(`${data.endedOn}T00:00:00Z`) : null, payrollNumber: data.payrollNumber } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "update", entity: "User", entityId: userId, summary: `Updated ${person.name}'s employment details` }, tx);
  });
  revalidate(userId);
  return ok();
}

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
  const session = await requirePermission("setup.departments");
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
  const session = await requirePermission("setup.departments");
  const orgId = await orgOf(session.user.id);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.department.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { name: true, archivedAt: true, _count: { select: { members: true } } } });
    if (!existing) return fail("That department no longer exists.");
    if (!!existing.archivedAt === archived) return ok();
    if (archived && existing._count.members > 0) return fail(`Move the ${existing._count.members} people in ${existing.name} first; their access may depend on it.`);
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
  const session = await requirePermission("setup.qualifications");
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
  const session = await requirePermission("setup.qualifications");
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

/** A certificate kept with a qualification: a PDF, PNG or JPEG up to 5 MB, checked by its first bytes. */
const CERTIFICATE_TYPES = { "application/pdf": [0x25, 0x50, 0x44, 0x46], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/jpeg": [0xff, 0xd8, 0xff] } as const;
const CERTIFICATE_MAX = 5 * 1024 * 1024;
async function certificateOf(file: File | null | undefined) {
  if (!file || file.size === 0) return { ok: true as const, file: null };
  if (file.size > CERTIFICATE_MAX) return { ok: false as const, error: "The certificate must be 5 MB or smaller." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = (Object.keys(CERTIFICATE_TYPES) as (keyof typeof CERTIFICATE_TYPES)[]).find((m) => CERTIFICATE_TYPES[m].every((b, i) => bytes[i] === b));
  if (!mime) return { ok: false as const, error: "Attach the certificate as a PDF, PNG or JPEG." };
  return { ok: true as const, file: { bytes, mime, fileName: file.name.slice(0, 120) || "certificate", size: bytes.length } };
}

export async function recordQualification(userId: string, input: QualificationInput, certificate?: File | null): Promise<ActionResult> {
  const session = await requireQualificationAccess(userId);
  const parsed = qualificationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { typeId, issuedOn, expiresOn, reference, note } = parsed.data;
  if (expiresOn && expiresOn < issuedOn) return fail("The expiry date is before the issue date.");
  const cert = await certificateOf(certificate);
  if (!cert.ok) return fail(cert.error);
  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { id: userId }, select: { name: true, orgId: true } });
    if (!person?.orgId) return fail("That account no longer exists.");
    const type = await tx.qualificationType.findFirst({ where: { id: typeId, orgId: person.orgId, archivedAt: null }, select: { name: true } });
    if (!type) return fail("That qualification is no longer offered.");
    const created = await tx.qualification.create({ data: {
      orgId: person.orgId, userId, typeId, issuedOn: new Date(`${issuedOn}T00:00:00Z`), expiresOn: expiresOn ? new Date(`${expiresOn}T00:00:00Z`) : null,
      reference, note, verifiedById: session.user.id, verifiedAt: new Date(),
    } });
    // The certificate it was recorded from, kept with it (Training's certificates, already verified).
    if (cert.file) await tx.qualificationEvidence.create({ data: {
      orgId: person.orgId, userId, typeId, typeName: type.name, issuedOn: created.issuedOn, expiresOn: created.expiresOn, reference,
      fileName: cert.file.fileName, mime: cert.file.mime, size: cert.file.size, bytes: cert.file.bytes,
      status: "VERIFIED", reviewedById: session.user.id, reviewedByName: actorName(session), reviewedAt: new Date(), qualificationId: created.id,
    } });
    await logAudit({ actorId: session.user.id, actorName: actorName(session), action: "record-qualification", entity: "Qualification", entityId: created.id, summary: `Recorded ${type.name} for ${person.name}${expiresOn ? `, valid until ${expiresOn}` : ""}${cert.file ? ", with its certificate" : ""}` }, tx);
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
