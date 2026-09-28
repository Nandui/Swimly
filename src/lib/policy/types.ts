import type { PermissionKey } from "@/lib/staff/permissions";

/** Where part of a role applies (docs/how-turnfin-works.md):
 *  - `all`: everywhere in the organisation.
 *  - `site`: one site the person works at, and the people who work there.
 *  - `reports`: the people they manage, directly or indirectly (HR "Their team"). */
export type Scope = { kind: "all" } | { kind: "site"; id: string } | { kind: "reports" };

export function scopeFrom(kind: string, id: string): Scope | null {
  if (kind === "all") return { kind: "all" };
  if (kind === "reports") return { kind: "reports" };
  if (kind === "site" && id) return { kind, id };
  return null;
}

/** One role's capabilities, bound to where they apply. */
export type Grant = { permissions: ReadonlySet<PermissionKey>; scope: Scope; roleName: string };

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

/** What a question is about: a person (`subjectUserId`) for people data
 *  such as training records or HR notes, or a `siteId` for site-bound data
 *  such as a swim class or a shift. */
export type Resource = {
  orgId?: string | null;
  subjectUserId?: string;
  siteId?: string;
};

/** The organisation chart, answered lazily and cached per request. Modules in
 *  another database (Docs, HR) need only the ids it returns. */
export interface Directory {
  reportsOf(managerId: string): Promise<ReadonlySet<string>>;
  /** The sites a person belongs to: their main site and the sites they work at. */
  sitesOf(userId: string): Promise<ReadonlySet<string>>;
  membersOfSites(siteIds: readonly string[]): Promise<ReadonlySet<string>>;
  orgMembers(orgId: string | null): Promise<ReadonlySet<string>>;
}

/** Whose records a capability reaches: everyone, or exactly these people. */
export type SubjectFilter = { kind: "all" } | { kind: "some"; userIds: ReadonlySet<string> };
/** Which sites a capability reaches, for site-bound data. */
export type SiteFilter = { kind: "all" } | { kind: "some"; siteIds: ReadonlySet<string> };
