import "server-only";
import { can, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/staff/permissions";

/** The shared setup every module uses, read for Admin's pages and for the
 *  modules that pick from it (docs/admin-setup.md). Organisation-wide, so the
 *  flat permission check is the right one: none of it belongs to a site's people. */

async function viewer() {
  const session = await requireSession();
  const keeps = (p: PermissionKey) => can(session, p);
  return { session, orgId: session.user.orgId ?? undefined, keeps };
}

/** The organisation's activity list, with what each needs, for Admin's Activities page. */
export async function activityListPage() {
  const { orgId, keeps } = await viewer();
  const [types, departments, qualifications] = await Promise.all([
    prisma.activityType.findMany({
      where: { orgId }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true, departmentId: true, requiredTypeId: true, fromClasses: true, archivedAt: true, department: { select: { name: true } }, requiredType: { select: { name: true } } },
    }),
    prisma.department.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.qualificationType.findMany({ where: { orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    canKeep: keeps("setup.activities"), departments, qualifications,
    types: types.map((t) => ({ id: t.id, name: t.name, icon: t.icon, departmentId: t.departmentId, departmentName: t.department.name, requiredTypeId: t.requiredTypeId,
      requiredName: t.requiredType?.name ?? null, fromClasses: t.fromClasses, archived: !!t.archivedAt })),
  };
}

/** Every open site with its areas, in order (archived ones last), for Admin's Areas page. */
export async function areasPage() {
  const { orgId, keeps } = await viewer();
  const sites = await prisma.club.findMany({
    where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, areas: { orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, archivedAt: true } } },
  });
  return { canKeep: keeps("setup.areas"), sites };
}

/** A site's open areas, in order: what a module's place field offers. */
export async function areaNames(siteId: string) {
  const rows = await prisma.siteArea.findMany({ where: { siteId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } });
  return rows.map((r) => r.name);
}

/** Why a "where" is not one of the site's areas, or null when it is (or is empty, or is the
 *  value it already had, so editing an older record never fails on it). */
export async function areaProblem(siteId: string, place: string, keep?: string | null) {
  const value = place.trim();
  if (!value || (keep && value.toLowerCase() === keep.trim().toLowerCase())) return null;
  const found = await prisma.siteArea.findFirst({ where: { siteId, archivedAt: null, name: { equals: value, mode: "insensitive" } }, select: { id: true } });
  return found ? null : `Choose one of the site's areas. ${value} is not on the list; add it under Admin, Areas.`;
}

/** Open areas for several sites at once, keyed by site. */
export async function areaNamesBySite(siteIds: readonly string[]) {
  const rows = siteIds.length ? await prisma.siteArea.findMany({ where: { siteId: { in: [...siteIds] }, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { siteId: true, name: true } }) : [];
  const out = new Map<string, string[]>(siteIds.map((id) => [id, []]));
  for (const r of rows) out.get(r.siteId)?.push(r.name);
  return out;
}
