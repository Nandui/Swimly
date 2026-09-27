import { expandPermissions, isRestrictedPermission, type PermissionKey } from "@/lib/staff/permissions";
import type { Actor, Directory, Grant, Resource, Scope, SiteFilter, SubjectFilter } from "./types";

/** The platform's single answer to "may this person do this, here, to them?".
 *
 *  Pure: everything about the organisation chart comes from a `Directory`, so
 *  the whole matrix is testable without a database and works for modules in
 *  other databases, which only ever receive plain ids.
 *
 *  Rules, in order:
 *  1. Another organisation's data is never reachable.
 *  2. A superadmin reaches everything in their organisation.
 *  3. Otherwise a grant must hold the capability *and* its scope must cover
 *     the resource. Self-service (a person's own records) is not a grant:
 *     each module's My surface serves it, so holding no capability never
 *     hides your own training, and holding one never shows you more of yours. */

export class AccessDenied extends Error {}

/** A step-up window: restricted capabilities need a password check this recent. */
export const STEP_UP_MS = 15 * 60 * 1000;

export function grantsFor(actor: Actor, cap: PermissionKey): Grant[] {
  return actor.grants.filter((grant) => grant.permissions.has(cap));
}

/** Holds the capability somewhere, whatever the scope. For navigation and for
 *  legacy checks that have no resource yet; never for reading records. */
export function holdsAnywhere(actor: Actor, cap: PermissionKey): boolean {
  return actor.superadmin || grantsFor(actor, cap).length > 0;
}

/** Whether the session proved itself with a password (not a PIN) recently. */
export function recentlyConfirmed(actor: Actor, now = Date.now()): boolean {
  if (actor.authMethod === "dev") return true;
  return actor.authMethod === "password" && actor.authAt !== null && now - actor.authAt <= STEP_UP_MS;
}

/** Restricted capabilities also need a fresh password (not a PIN) session. */
export function needsStepUp(actor: Actor, cap: PermissionKey, now = Date.now()): boolean {
  if (!isRestrictedPermission(cap)) return false;
  return !recentlyConfirmed(actor, now);
}

async function scopeCovers(scope: Scope, actor: Actor, resource: Resource, dir: Directory): Promise<boolean> {
  switch (scope.kind) {
    case "all":
      return true;
    case "reports":
      return !!resource.subjectUserId && (await dir.reportsOf(actor.id)).has(resource.subjectUserId);
    case "department":
      if (resource.departmentId) return resource.departmentId === scope.id;
      if (resource.subjectUserId) return (await dir.departmentsOf(resource.subjectUserId)).has(scope.id);
      return false;
    case "site": {
      if (resource.siteId) return resource.siteId === scope.id;
      if (resource.departmentId) return (await dir.sitesOfDepartments([resource.departmentId])).get(resource.departmentId) === scope.id;
      if (resource.subjectUserId) {
        if ((await dir.primarySiteOf(resource.subjectUserId)) === scope.id) return true;
        const departments = [...(await dir.departmentsOf(resource.subjectUserId))];
        const sites = await dir.sitesOfDepartments(departments);
        return departments.some((id) => sites.get(id) === scope.id);
      }
      return false;
    }
  }
}

function sameOrg(actor: Actor, resource: Resource) {
  return resource.orgId === undefined || resource.orgId === null || actor.orgId === null || resource.orgId === actor.orgId;
}

export async function can(actor: Actor, cap: PermissionKey, resource: Resource, dir: Directory): Promise<boolean> {
  if (!sameOrg(actor, resource)) return false;
  if (actor.superadmin) return true;
  for (const grant of grantsFor(actor, cap)) if (await scopeCovers(grant.scope, actor, resource, dir)) return true;
  return false;
}

export async function requireCap(actor: Actor, cap: PermissionKey, resource: Resource, dir: Directory) {
  if (needsStepUp(actor, cap)) throw new AccessDenied("Confirm your password to open this.");
  if (!(await can(actor, cap, resource, dir))) throw new AccessDenied(`You do not have permission to do that (${cap}).`);
}

/** Whose records a capability reaches, as ids a query can filter by. Unions
 *  every grant; `all` wins. Never includes another organisation. */
export async function subjectFilter(actor: Actor, cap: PermissionKey, dir: Directory): Promise<SubjectFilter> {
  const grants = grantsFor(actor, cap);
  if (actor.superadmin || grants.some((grant) => grant.scope.kind === "all")) {
    return actor.orgId ? { kind: "some", userIds: await dir.orgMembers(actor.orgId) } : { kind: "all" };
  }
  const ids = new Set<string>();
  const sites: string[] = [], departments: string[] = [];
  for (const { scope } of grants) {
    if (scope.kind === "reports") for (const id of await dir.reportsOf(actor.id)) ids.add(id);
    if (scope.kind === "site") sites.push(scope.id);
    if (scope.kind === "department") departments.push(scope.id);
  }
  if (departments.length) for (const id of await dir.membersOfDepartments(departments)) ids.add(id);
  if (sites.length) for (const id of await dir.membersOfSites(sites)) ids.add(id);
  return { kind: "some", userIds: ids };
}

/** Which sites a capability reaches, for site-bound data (classes, rotas). A
 *  department grant reaches its department's site; `reports` reaches none. */
export async function siteFilter(actor: Actor, cap: PermissionKey, dir: Directory): Promise<SiteFilter> {
  const grants = grantsFor(actor, cap);
  if (actor.superadmin || grants.some((grant) => grant.scope.kind === "all")) return { kind: "all" };
  const ids = new Set<string>();
  const departments: string[] = [];
  for (const { scope } of grants) {
    if (scope.kind === "site") ids.add(scope.id);
    if (scope.kind === "department") departments.push(scope.id);
  }
  for (const site of (await dir.sitesOfDepartments(departments)).values()) if (site) ids.add(site);
  return { kind: "some", siteIds: ids };
}

export function filterAllows(filter: SubjectFilter, userId: string) {
  return filter.kind === "all" || filter.userIds.has(userId);
}

/** Builds an Actor from role grants. `primary` always applies everywhere;
 *  assignments add capabilities where their scope says. */
export function actorFrom(input: {
  id: string;
  name: string;
  orgId: string | null;
  superadmin: boolean;
  primary: { name: string; permissions: readonly string[]; screens: readonly string[] } | null;
  assignments: { roleName: string; permissions: readonly string[]; screens: readonly string[]; scope: Scope }[];
  authMethod?: Actor["authMethod"];
  authAt?: number | null;
}): Actor {
  const grants: Grant[] = [];
  if (input.primary) {
    grants.push({ roleName: input.primary.name, permissions: expandPermissions(input.primary.permissions, { superadmin: input.superadmin }), screens: input.primary.screens, scope: { kind: "all" } });
  }
  for (const assignment of input.assignments) {
    grants.push({ roleName: assignment.roleName, permissions: expandPermissions(assignment.permissions), screens: assignment.screens, scope: assignment.scope });
  }
  return {
    id: input.id, name: input.name, orgId: input.orgId, superadmin: input.superadmin, grants,
    authMethod: input.authMethod ?? "password", authAt: input.authAt ?? null,
  };
}
