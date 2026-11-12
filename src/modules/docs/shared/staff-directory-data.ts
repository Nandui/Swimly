/** The Turnfin staff directory as Docs sees it. Server code imports it through
 *  ./staff-directory (server-only); operator scripts import this file directly.
 *  People and the organisation chart come from Core (src/lib/directory.ts). */
import { organisationChart, staffProfile, staffProfiles, type StaffProfile } from '@/lib/directory';
import { ALL_PERMISSIONS } from '@/lib/staff/permissions';
import type { StaffDirectory, StaffIdentity } from '@/modules/docs/shared/database';

function identity(user: StaffProfile): StaffIdentity {
  return { id: user.id, name: user.name, email: user.email,
    active: user.isActive && !!user.role, role: user.role?.name ?? '',
    permissions: user.isSuperadmin ? [...ALL_PERMISSIONS] : [...(user.role?.permissions ?? [])],
    // One organisation chart: the person's main site, their departments and
    // those departments' sites, as Docs facility and team membership.
    siteIds: [...new Set([user.primarySiteId, ...user.departments.map((d) => d.siteId)].filter((id): id is string => !!id))],
    departmentIds: user.departments.map((d) => d.id),
    // Their role, as a Docs team: reading can be aimed at a role.
    roleIds: user.role ? [user.role.id] : [],
  };
}
// No persisted permission copy or cross-request cache: revocation remains live.
// Passwords and parent/swimmer records never enter the Docs database.
export const staffDirectory: StaffDirectory = {
  async find(id) { const user = await staffProfile(id); return user ? identity(user) : null; },
  async list() { return (await staffProfiles()).map(identity); },
  organisation: organisationChart,
};
