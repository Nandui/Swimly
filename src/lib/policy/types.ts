import type { PermissionKey } from "@/lib/staff/permissions";

/** Where a grant applies. A role says *what* someone may do; the assignment
 *  says *where* or *over whom*:
 *  - `all`: everywhere in the organisation (every primary role).
 *  - `site`: one site (a Club) and the people based there.
 *  - `department`: one department and its members.
 *  - `reports`: the holder's own direct and indirect reports (line management). */
export type ScopeKind = "all" | "site" | "department" | "reports";
export const SCOPE_KINDS: readonly ScopeKind[] = ["all", "site", "department", "reports"];
export type Scope =
  | { kind: "all" }
  | { kind: "site"; id: string }
  | { kind: "department"; id: string }
  | { kind: "reports" };

export function isScopeKind(value: string): value is ScopeKind {
  return (SCOPE_KINDS as readonly string[]).includes(value);
}

export function scopeFrom(kind: string, id: string): Scope | null {
  if (kind === "all") return { kind: "all" };
  if (kind === "reports") return { kind: "reports" };
  if ((kind === "site" || kind === "department") && id) return { kind, id };
  return null;
}

/** One role's capabilities, bound to where they apply. */
export type Grant = { permissions: ReadonlySet<PermissionKey>; screens: readonly string[]; scope: Scope; roleName: string };

/** Everything an authorization question needs to know about the person asking. */
export type Actor = {
  id: string;
  name: string;
  orgId: string | null;
  superadmin: boolean;
  grants: readonly Grant[];
  /** How this session proved who it is, and when (step-up for restricted data). */
  authMethod: "password" | "pin" | "dev";
  authAt: number | null;
};

/** What a question is about. Give what you know: a person (`subjectUserId`)
 *  for people data such as training records or HR notes; a `siteId` for
 *  site-bound data such as a swim class; a `departmentId` for team data. */
export type Resource = {
  orgId?: string | null;
  subjectUserId?: string;
  siteId?: string;
  departmentId?: string;
};

/** The organisation chart, answered lazily and cached per request. Modules in
 *  another database (Docs, HR) need only the ids it returns. */
export interface Directory {
  reportsOf(managerId: string): Promise<ReadonlySet<string>>;
  departmentsOf(userId: string): Promise<ReadonlySet<string>>;
  primarySiteOf(userId: string): Promise<string | null>;
  sitesOfDepartments(departmentIds: readonly string[]): Promise<ReadonlyMap<string, string | null>>;
  membersOfDepartments(departmentIds: readonly string[]): Promise<ReadonlySet<string>>;
  membersOfSites(siteIds: readonly string[]): Promise<ReadonlySet<string>>;
  orgMembers(orgId: string | null): Promise<ReadonlySet<string>>;
}

/** Whose records a capability reaches: everyone, or exactly these people. */
export type SubjectFilter = { kind: "all" } | { kind: "some"; userIds: ReadonlySet<string> };
/** Which sites a capability reaches, for site-bound data. */
export type SiteFilter = { kind: "all" } | { kind: "some"; siteIds: ReadonlySet<string> };
