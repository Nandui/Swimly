import "server-only";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/format";

/** Reads for the People core. Account administration (`staff.manage`) sees
 *  accounts and the organisation's structure; nothing here returns staff
 *  details, which are HR's. */

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

/** One person's account for Admin's Staff page: who they are, their role and
 *  where it applies. Their details (position, employment, contact,
 *  qualifications) are HR's, read through `src/modules/hr/lib/records.ts`. */
export async function getPersonDetail(userId: string) {
  const session = await requirePermission("staff.manage");
  const person = await prisma.user.findFirst({
    where: { id: userId, orgId: session.user.orgId ?? undefined },
    select: {
      id: true, name: true, email: true, isActive: true, isSuperadmin: true, createdAt: true, passwordHash: true, siteIds: true,
      staffRole: { select: { id: true, name: true, levels: true, extras: true, permissions: true, screens: true, homeName: true } },
    },
  });
  if (!person) return null;
  const sites = await prisma.club.findMany({ where: { id: { in: person.siteIds } }, select: { id: true, name: true } });
  const names = new Map(sites.map((row) => [row.id, row.name]));
  const { passwordHash, ...rest } = person;
  return { ...rest, hasPassword: Boolean(passwordHash), worksAt: person.siteIds.map((id) => ({ id, name: names.get(id) ?? "Removed site" })) };
}
