import "server-only";
import type { SubjectFilter } from "@/lib/policy/types";
import { prisma } from "@/lib/prisma";

/** Core's staff records, for the module that keeps staff details (owner
 *  decision, 8 October 2026: staff details are HR's, not Admin's). The details
 *  live on Core's account, so modules read them here instead of querying it.
 *  Every function returns personal data: callers have already checked the
 *  capability over the person (the policy engine), and log the read. */

/** A person in this organisation, by name and job title; null when there is none. */
export async function staffMember(userId: string, orgId: string | null) {
  return prisma.user.findFirst({ where: { id: userId, orgId: orgId || undefined }, select: { id: true, name: true, jobTitle: true } });
}

/** A person's organisation; null when there is no such account. */
export async function staffOrganisation(userId: string): Promise<{ orgId: string | null } | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } });
}

/** Active staff in this organisation the reader covers, by name, optionally matching a name. */
export async function activeStaffCovered(orgId: string | null, scope: SubjectFilter, query = "", take = 200) {
  return prisma.user.findMany({
    where: {
      orgId: orgId || undefined, isActive: true,
      ...(scope.kind === "all" ? {} : { id: { in: [...scope.userIds] } }),
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" }, take,
    select: { id: true, name: true, jobTitle: true },
  });
}

/** A person's details: position, manager, departments, the people who report to them,
 *  employment and contact, with their main site's name. */
export async function staffDetails(userId: string) {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      jobTitle: true, positionId: true, startedOn: true, dateOfBirth: true, primaryClubId: true, managerId: true,
      contractType: true, contractMinutes: true, endedOn: true, payrollNumber: true,
      phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
      position: { select: { name: true, archivedAt: true } },
      manager: { select: { id: true, name: true } },
      departments: { select: { departmentId: true, isPrimary: true, department: { select: { name: true } } } },
      reports: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  const site = row.primaryClubId ? await prisma.club.findUnique({ where: { id: row.primaryClubId }, select: { name: true } }) : null;
  return { ...row, primaryClub: row.primaryClubId ? site?.name ?? "Removed site" : null };
}

/** What a details editor chooses from: open sites, departments and positions, and the
 *  active people who can manage. An archived position stays only for whoever holds it. */
export async function staffDetailOptions(orgId: string, positionId: string | null) {
  const [sites, departments, positions, people] = await Promise.all([
    prisma.club.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.department.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.position.findMany({ where: { orgId, OR: [{ archivedAt: null }, { id: positionId ?? "" }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } }),
  ]);
  return { sites, departments, positions, people };
}

/** Everything Core keeps on a person, for a subject export, with every qualification they
 *  were given (revoked ones too). Null when they are not in this organisation. */
export async function staffRecordForExport(userId: string, orgId: string | null) {
  const person = await prisma.user.findFirst({
    where: { id: userId, orgId: orgId ?? undefined },
    select: {
      id: true, name: true, email: true, jobTitle: true, startedOn: true, isActive: true, createdAt: true,
      dateOfBirth: true, contractType: true, contractMinutes: true, endedOn: true, payrollNumber: true,
      phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
    },
  });
  if (!person) return null;
  const qualifications = await prisma.qualification.findMany({ where: { userId }, select: { issuedOn: true, expiresOn: true, revokedAt: true, reference: true, note: true, type: { select: { name: true } } } });
  return { person, qualifications };
}

/** How many details changes sent from Turnfin Me are waiting, for the people the reader covers. */
export async function pendingDetailChanges(orgId: string | null, scope: SubjectFilter): Promise<number> {
  return prisma.staffDetailChangeRequest.count({
    where: { orgId: orgId ?? undefined, status: "PENDING", ...(scope.kind === "all" ? {} : { userId: { in: [...scope.userIds] } }) },
  });
}
