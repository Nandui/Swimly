import "server-only";
import { cache } from "react";
import type { Session } from "next-auth";
import { requireSession, AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/staff/permissions";
import { actorFrom, can, needsStepUp, recentlyConfirmed, siteFilter, subjectFilter } from "./engine";
import { scopeFrom, type Actor, type Directory, type Resource } from "./types";

/** The running app's connection to the policy engine. Modules call these;
 *  nothing else in the app needs to know how scopes resolve. */

export function actorForSession(session: Session): Actor {
  const user = session.user;
  return actorFrom({
    id: user.id,
    name: user.name ?? "Unknown",
    orgId: user.orgId ?? null,
    superadmin: user.isSuperadmin === true,
    primary: { name: user.roleName, permissions: user.primaryPermissions ?? user.permissions },
    assignments: (user.grants ?? []).flatMap((grant) => {
      const scope = scopeFrom(grant.scopeKind, grant.scopeId);
      return scope ? [{ roleName: grant.roleName, permissions: grant.permissions, scope }] : [];
    }),
    authMethod: user.authMethod ?? "password",
    authAt: user.authAt ?? null,
  });
}

/** The organisation chart from the main database, memoised per request. */
const prismaDirectory = cache((): Directory => {
  const memo = new Map<string, Promise<unknown>>();
  const once = <T,>(key: string, load: () => Promise<T>) => {
    if (!memo.has(key)) memo.set(key, load());
    return memo.get(key) as Promise<T>;
  };
  return {
    reportsOf: (managerId) => once(`reports:${managerId}`, async () => {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE chain(id, depth) AS (
          SELECT "id", 1 FROM "User" WHERE "managerId" = ${managerId}
          UNION
          SELECT u."id", c.depth + 1 FROM "User" u JOIN chain c ON u."managerId" = c.id WHERE c.depth < 20
        ) SELECT DISTINCT id FROM chain`;
      return new Set(rows.map((row) => row.id));
    }),
    sitesOf: (userId) => once(`sites:${userId}`, async () => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { primaryClubId: true, siteIds: true } });
      return new Set([...(user?.primaryClubId ? [user.primaryClubId] : []), ...(user?.siteIds ?? [])]);
    }),
    membersOfSites: (ids) => once(`smembers:${[...ids].sort().join(",")}`, async () => {
      const users = await prisma.user.findMany({
        where: { OR: [{ primaryClubId: { in: [...ids] } }, { siteIds: { hasSome: [...ids] } }] },
        select: { id: true },
      });
      return new Set(users.map((row) => row.id));
    }),
    orgMembers: (orgId) => once(`org:${orgId}`, async () =>
      new Set((await prisma.user.findMany({ where: orgId ? { orgId } : {}, select: { id: true } })).map((row) => row.id))),
  };
});

export const currentActor = cache(async () => actorForSession(await requireSession()));

/** Throws unless the signed-in person may use `cap` on `resource`. Restricted
 *  capabilities also need a recent password check (not a PIN session). */
export async function requireCapFor(cap: PermissionKey, resource: Resource) {
  const actor = await currentActor();
  if (needsStepUp(actor, cap)) throw new StepUpRequired();
  if (!(await can(actor, cap, resource, prismaDirectory()))) {
    throw new AuthorizationError(`You do not have permission to do that (${cap})`);
  }
  return actor;
}

export async function mayFor(cap: PermissionKey, resource: Resource) {
  const actor = await currentActor();
  return !needsStepUp(actor, cap) && can(actor, cap, resource, prismaDirectory());
}

export async function subjectsFor(cap: PermissionKey) {
  return subjectFilter(await currentActor(), cap, prismaDirectory());
}

export async function sitesFor(cap: PermissionKey) {
  return siteFilter(await currentActor(), cap);
}

class StepUpRequired extends AuthorizationError {
  constructor() { super("Confirm your password to open this."); }
}

/** Read-audit for restricted data: who looked at whose records, and why.
 *  Modules with their own database write the same shape to their own table. */
export async function logAccess(input: { actor: Actor; cap: PermissionKey; entity: string; entityId?: string; subjectUserIds: readonly string[]; purpose: string }) {
  if (input.subjectUserIds.length === 0) return;
  await logAudit({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "view",
    entity: input.entity,
    entityId: input.entityId,
    summary: `${input.actor.name} viewed ${input.purpose} (${input.cap})`,
    details: { cap: input.cap, subjectUserIds: [...input.subjectUserIds].slice(0, 200) },
  });
}

/** For pages that open restricted records: sends the person to confirm their
 *  password first when the session is a PIN switch or not recently confirmed,
 *  then back to `returnTo`. */
export async function requireFreshSession(cap: PermissionKey, returnTo: string) {
  const actor = await currentActor();
  if (needsStepUp(actor, cap)) {
    const { redirect } = await import("next/navigation");
    redirect(`/confirm-password?next=${encodeURIComponent(returnTo)}`);
  }
  return actor;
}

/** For a person's own restricted records (their shared HR notes and reviews):
 *  the same recent-password rule as restricted capabilities, without one. */
export async function requireRecentPassword(returnTo: string) {
  const actor = await currentActor();
  if (!recentlyConfirmed(actor)) {
    const { redirect } = await import("next/navigation");
    redirect(`/confirm-password?next=${encodeURIComponent(returnTo)}`);
  }
  return actor;
}
