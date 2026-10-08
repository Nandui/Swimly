import "server-only";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/format";

/** Reads for the People core. Account administration (`staff.manage`) sees
 *  the whole organisation chart; nothing here returns restricted (HR) data. */

export async function getOrganisation() {
  const session = await requirePermission("setup.view");
  const orgId = session.user.orgId ?? undefined;
  const [organisation, sites, departments, qualificationTypes] = await Promise.all([
    prisma.organisation.findFirst({ where: { id: orgId }, select: { id: true, name: true } }),
    prisma.club.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.department.findMany({
      where: { orgId }, orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, clubId: true, archivedAt: true, club: { select: { name: true } }, _count: { select: { members: true } } },
    }),
    prisma.qualificationType.findMany({
      where: { orgId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true, validityMonths: true, archivedAt: true, _count: { select: { qualifications: { where: { revokedAt: null } } } } },
    }),
  ]);
  return { organisation, sites, departments, qualificationTypes };
}
export type Organisation = Awaited<ReturnType<typeof getOrganisation>>;

export type QualificationState = "valid" | "expiring" | "expired" | "revoked";
/** Expiring = within 60 days, the usual renewal window for NPLQ and first aid. */
export function qualificationState(q: { expiresOn: Date | null; revokedAt: Date | null }, on = today()): QualificationState {
  if (q.revokedAt) return "revoked";
  if (!q.expiresOn) return "valid";
  const expires = q.expiresOn.toISOString().slice(0, 10);
  if (expires < on) return "expired";
  const soon = new Date(`${on}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 60);
  return expires <= soon.toISOString().slice(0, 10) ? "expiring" : "valid";
}

export async function getPersonDetail(userId: string) {
  const session = await requirePermission("staff.manage");
  const person = await prisma.user.findFirst({
    where: { id: userId, orgId: session.user.orgId ?? undefined },
    select: {
      id: true, name: true, email: true, isActive: true, jobTitle: true, startedOn: true, dateOfBirth: true, isSuperadmin: true,
      orgId: true, positionId: true, contractType: true, contractMinutes: true, endedOn: true, payrollNumber: true,
      phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
      position: { select: { id: true, name: true, archivedAt: true, requires: { select: { type: { select: { id: true, name: true } } } } } },
      primaryClubId: true, managerId: true, siteIds: true,
      manager: { select: { id: true, name: true } },
      staffRole: { select: { id: true, name: true, levels: true, extras: true, permissions: true, screens: true, homeName: true } },
      departments: { select: { departmentId: true, isPrimary: true, department: { select: { name: true } } } },
      reports: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } },
      qualifications: {
        orderBy: [{ revokedAt: "asc" }, { expiresOn: "asc" }],
        select: { id: true, typeId: true, issuedOn: true, expiresOn: true, reference: true, note: true, revokedAt: true, verifiedAt: true, verifiedById: true, type: { select: { name: true } } },
      },
    },
  });
  if (!person) return null;
  const verifierIds = person.qualifications.flatMap((q) => (q.verifiedById ? [q.verifiedById] : []));
  const [sites, verifiers] = await Promise.all([
    prisma.club.findMany({ where: { id: { in: [...person.siteIds, ...(person.primaryClubId ? [person.primaryClubId] : [])] } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, name: true } }),
  ]);
  const verifierNames = new Map(verifiers.map((v) => [v.id, v.name]));
  const names = new Map(sites.map((row) => [row.id, row.name]));
  return {
    ...person,
    primaryClub: person.primaryClubId ? { name: names.get(person.primaryClubId) ?? "Removed site" } : null,
    worksAt: person.siteIds.map((id) => ({ id, name: names.get(id) ?? "Removed site" })),
    startedOn: person.startedOn?.toISOString().slice(0, 10) ?? "",
    dateOfBirth: person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
    /** The records as stored, for what their position needs (`requirementStates`). */
    qualificationRecords: person.qualifications.map((q) => ({ typeId: q.typeId, issuedOn: q.issuedOn, expiresOn: q.expiresOn, revokedAt: q.revokedAt })),
    qualifications: person.qualifications.map((q) => ({
      id: q.id, name: q.type.name, reference: q.reference, note: q.note,
      issuedOn: q.issuedOn.toISOString().slice(0, 10), expiresOn: q.expiresOn?.toISOString().slice(0, 10) ?? "",
      verifiedBy: q.verifiedById ? verifierNames.get(q.verifiedById) ?? null : null, state: qualificationState(q),
    })),
  };
}
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonDetail>>>;

/** Everyone in the organisation, for the manager picker. */
export async function listPeopleOptions() {
  const session = await requirePermission("staff.manage");
  return prisma.user.findMany({ where: { orgId: session.user.orgId ?? undefined, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } });
}

/** One summary line per person for the Staff table: departments and manager. */
export async function listPeopleOrg() {
  const session = await requirePermission("staff.manage");
  const rows = await prisma.user.findMany({
    where: { orgId: session.user.orgId ?? undefined },
    select: {
      id: true, jobTitle: true, isSuperadmin: true, manager: { select: { name: true } },
      departments: { select: { department: { select: { name: true } } } },
    },
  });
  return new Map(rows.map((row) => [row.id, {
    jobTitle: row.jobTitle, isSuperadmin: row.isSuperadmin, manager: row.manager?.name ?? null,
    departments: row.departments.map((d) => d.department.name),
  }]));
}
