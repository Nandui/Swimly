/** Three permission tiers, not a permission matrix.
 *
 *  Every role in the product maps onto one of three answers: can they change
 *  the shape of the system, can they change the data, or can they only read
 *  it. Screens and actions ask the tier, never the role — so adding a role is
 *  one line here and no edits anywhere else, and no call site can drift into
 *  its own idea of who may do what.
 *
 *  `Role` comes from the Prisma schema, so adding a value there breaks
 *  `TIER_BY_ROLE` until you say which tier it belongs to. That is the point:
 *  the compiler, not a reviewer, catches the unplaced role. */

import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/client";

export type PermissionTier = "admin" | "manage" | "view";

/** ADMIN changes the rules — programmes, levels, competencies, courses and
 *  accounts. INSTRUCTOR changes the data — students, enrolments, attendance
 *  and assessments. VIEWER reads it: reception, or a duty manager.
 *
 *  If a role's tier is genuinely ambiguous, that is a signal the role is doing
 *  two jobs, not that you need a fourth tier. Scoping rules — an instructor
 *  marking only their own registers — belong in the action, not here. */
const TIER_BY_ROLE: Record<Role, PermissionTier> = {
  ADMIN: "admin",
  INSTRUCTOR: "manage",
  VIEWER: "view",
};

/** Roles are never shown as raw enum values — the label and tint live
 *  together in `ROLE_META` in `src/lib/people/constants.ts`, one map per enum,
 *  so there is only ever one place that decides how a role reads. */

export function tierOf(role: Role): PermissionTier {
  return TIER_BY_ROLE[role];
}

export function canManage(role: Role): boolean {
  return tierOf(role) !== "view";
}

export function isAdmin(role: Role): boolean {
  return tierOf(role) === "admin";
}

export class AuthorizationError extends Error {}

/** Returns the session or throws. Use in data modules for read access. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new AuthorizationError("Not signed in");
  return session;
}

/** Requires the manage tier. Every mutating action starts with one of these. */
export async function requireManage() {
  const session = await requireSession();
  if (!canManage(session.user.role)) {
    throw new AuthorizationError("You don't have permission to make changes");
  }
  return session;
}

/** Requires the admin tier: user management, app settings, anything that
 *  changes the rules rather than the data. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user.role)) {
    throw new AuthorizationError("Admin access required");
  }
  return session;
}
