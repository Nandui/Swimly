/** The Turnfin staff directory as Docs sees it. Server code imports it through
 *  ./staff-directory (server-only); operator scripts import this file directly. */
import { prisma } from '@/lib/prisma';
import { ALL_PERMISSIONS } from '@/lib/staff/permissions';
import type { StaffDirectory, StaffIdentity } from '@/modules/docs/shared/database';

const select = { id: true, name: true, email: true, isActive: true, isSuperadmin: true, primaryClubId: true,
  departments: { select: { departmentId: true, department: { select: { clubId: true, archivedAt: true } } } },
  staffRole: { select: { id: true, name: true, permissions: true } },
} as const;
function identity(user: { id: string; name: string; email: string; isActive: boolean; isSuperadmin: boolean; primaryClubId: string | null;
  departments: { departmentId: string; department: { clubId: string | null; archivedAt: Date | null } }[];
  staffRole: { id: string; name: string; permissions: string[] } | null;
}): StaffIdentity {
  const departments = (user.departments ?? []).filter((d) => !d.department.archivedAt);
  return { id: user.id, name: user.name, email: user.email,
    active: user.isActive && !!user.staffRole, role: user.staffRole?.name ?? '',
    permissions: user.isSuperadmin ? [...ALL_PERMISSIONS] : [...(user.staffRole?.permissions ?? [])],
    // One organisation chart: the person's main site, their departments and
    // those departments' sites, as Docs facility and team membership.
    siteIds: [...new Set([user.primaryClubId, ...departments.map((d) => d.department.clubId)].filter((id): id is string => !!id))],
    departmentIds: departments.map((d) => d.departmentId),
    // Their role, as a Docs team: reading can be aimed at a role.
    roleIds: user.staffRole ? [user.staffRole.id] : [],
  };
}
// No persisted permission copy or cross-request cache: revocation remains live.
// Passwords and parent/swimmer records never enter the Docs database.
export const staffDirectory: StaffDirectory = {
  async find(id) { const user = await prisma.user.findUnique({ where: { id }, select }); return user ? identity(user) : null; },
  async list() { return (await prisma.user.findMany({ select, orderBy: { name: 'asc' } })).map(identity); },
  async organisation() {
    const [sites, departments, roles] = await Promise.all([
      prisma.club.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
      prisma.department.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
      prisma.staffRole.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    ]);
    return { sites, departments, roles };
  },
};
