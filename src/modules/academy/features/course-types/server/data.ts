import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationTypesOf, withQualificationTypes } from "@/lib/qualifications";
import { requireAcademyActor } from "@/modules/academy/shared/access";

/** The Academy's reads (docs/academy.md). Courses are limited to the sites `academy.read`
 *  covers; a course outside them is a 404. The course list belongs to the organisation. */


/** The course list (Manage keeps it), with what each grants. */
export async function courseTypes() {
  const who = await requireAcademyActor();
  const [rows, qualifications] = await Promise.all([
    prisma.academyCourseType.findMany({
      where: { orgId: who.orgId ?? undefined }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, awardingBody: true, minAge: true, minHours: true, checks: true, qualificationTypeId: true, archivedAt: true,
        _count: { select: { courses: true } } },
    }),
    qualificationTypesOf(who.orgId ?? null).then((list) => list.map(({ id, name }) => ({ id, name }))),
  ]);
  const types = await withQualificationTypes(rows, "qualificationTypeId", "qualificationType");
  return { who, types, qualifications };
}
