import "server-only";
import { prisma } from "@/lib/prisma";
import { requireShortCoursesActor } from "@/modules/short-courses/shared/access";

/** The course list (Manage keeps it): what we offer, and how many runs each has had. */
export async function courseTypes() {
  const who = await requireShortCoursesActor();
  const types = await prisma.shortCourseType.findMany({
    where: { orgId: who.orgId ?? undefined }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, area: true, description: true, weeks: true, sessionMinutes: true, minAge: true, healthForm: true, archivedAt: true, _count: { select: { courses: true } } },
  });
  return { who, types };
}
