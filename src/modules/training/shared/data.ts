import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import type { SubjectFilter } from "@/lib/policy/types";
import type { PermissionKey } from "@/lib/staff/permissions";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { EXPIRY_WARNING_DAYS } from "@/modules/training/shared/constants";

/** Training reads. Every list of people's records is limited to the people
 *  the capability covers, resolved by the policy engine; the course catalogue
 *  is organisation data any Training user may read. */

export const people = (filter: SubjectFilter): Prisma.StringFilter | undefined =>
  filter.kind === "all" ? undefined : { in: [...filter.userIds] };

export async function scopedUserIds(cap: PermissionKey) {
  return people(await subjectsFor(cap));
}

export function isoPlusDays(iso: string, days: number) {
  const date = parseDateOnly(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function listCourses(options: { archived?: boolean } = {}) {
  const who = await requireTrainingActor();
  const courses = await prisma.trainingCourse.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: options.archived ? { not: null } : null },
    orderBy: { title: "asc" },
    select: { id: true, title: true, summary: true, content: true, requiresSignoff: true, archivedAt: true, grantsType: { select: { id: true, name: true, validityMonths: true } } },
  });
  return { who, courses };
}
export type CourseRow = Awaited<ReturnType<typeof listCourses>>["courses"][number];

/** Active people the signed-in person may assign training to. */
export async function assignablePeople() {
  const who = await requireTrainingActor();
  if (!who.assign) return [];
  return prisma.user.findMany({
    where: { orgId: who.orgId ?? undefined, isActive: true, id: await scopedUserIds("training.assign") },
    orderBy: { name: "asc" },
    // Their role, so a course can be given to everyone on a role at once.
    select: { id: true, name: true, jobTitle: true, staffRole: { select: { id: true, name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Expiring qualifications, with the course that renews each
// ---------------------------------------------------------------------------

/** Who a filtered list covers: at a site (or every site), in a position. */
export type ExpiringFilters = { site?: string; position?: string };
export const filteredPeople = (f: ExpiringFilters): Prisma.UserWhereInput => ({
  isActive: true,
  ...(f.site ? { OR: [{ siteIds: { has: f.site } }, { siteIds: { isEmpty: true } }] } : {}),
  ...(f.position ? { positionId: f.position } : {}),
});

export async function expiringQualificationRows(orgId: string | null, userId: Prisma.StringFilter | undefined, on: string, filters: ExpiringFilters = {}) {
  const horizon = parseDateOnly(isoPlusDays(on, EXPIRY_WARNING_DAYS));
  const rows = await prisma.qualification.findMany({
    where: { orgId: orgId ?? undefined, userId, revokedAt: null, expiresOn: { lte: horizon }, user: filteredPeople(filters) },
    orderBy: { expiresOn: "asc" },
    select: { id: true, userId: true, typeId: true, expiresOn: true, revokedAt: true, type: { select: { name: true } }, user: { select: { name: true, jobTitle: true } } },
  });
  if (rows.length === 0) return [];
  // A newer certificate of the same type replaces an expiring one.
  const newer = await prisma.qualification.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, typeId: { in: [...new Set(rows.map((r) => r.typeId))] }, revokedAt: null, OR: [{ expiresOn: null }, { expiresOn: { gt: horizon } }] },
    select: { userId: true, typeId: true },
  });
  const renewed = new Set(newer.map((q) => `${q.userId}:${q.typeId}`));
  return rows.filter((r) => !renewed.has(`${r.userId}:${r.typeId}`));
}
