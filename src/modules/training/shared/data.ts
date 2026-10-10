import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { activeStaffWithRoles } from "@/lib/directory";
import { addDaysIso, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import type { SubjectFilter } from "@/lib/policy/types";
import { qualificationsExpiringBy, type StaffFilters, withQualificationTypes } from "@/lib/qualifications";
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

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function listCourses(options: { archived?: boolean } = {}) {
  const who = await requireTrainingActor();
  const rows = await prisma.trainingCourse.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: options.archived ? { not: null } : null },
    orderBy: { title: "asc" },
    select: { id: true, title: true, summary: true, content: true, requiresSignoff: true, archivedAt: true, grantsTypeId: true },
  });
  const courses = (await withQualificationTypes(rows, "grantsTypeId", "grantsType"))
    .map(({ id, title, summary, content, requiresSignoff, archivedAt, grantsType }) => ({
      id, title, summary, content, requiresSignoff, archivedAt, grantsType: grantsType && { id: grantsType.id, name: grantsType.name, validityMonths: grantsType.validityMonths },
    }));
  return { who, courses };
}
export type CourseRow = Awaited<ReturnType<typeof listCourses>>["courses"][number];

/** Active people the signed-in person may assign training to. */
export async function assignablePeople() {
  const who = await requireTrainingActor();
  if (!who.assign) return [];
  // Their role, so a course can be given to everyone on a role at once.
  return activeStaffWithRoles(who.orgId ?? null, await subjectsFor("training.assign"));
}

// ---------------------------------------------------------------------------
// Expiring qualifications, with the course that renews each
// ---------------------------------------------------------------------------

/** Who a filtered list covers: at a site (or every site), in a position. */
export type ExpiringFilters = StaffFilters;

/** Qualifications expired or expiring within the warning window; a newer certificate of the
 *  same type replaces an expiring one. */
export async function expiringQualificationRows(orgId: string | null, reach: SubjectFilter, on: string, filters: ExpiringFilters = {}) {
  return qualificationsExpiringBy(orgId, reach, parseDateOnly(addDaysIso(on, EXPIRY_WARNING_DAYS)), filters);
}
