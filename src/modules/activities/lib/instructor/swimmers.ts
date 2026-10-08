import "server-only";
import { AuthorizationError, can } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { plannedTeachers } from "@/modules/activities/lib/courses/planned";
import { classifyMedical, requireActivitiesAccess } from "@/modules/activities/classification";

/** The deck's swimmer lookup (owner decision, September 2026): instructors can
 *  find any swimmer with a current place at the site they are working in. It
 *  shows who they are and where they swim, never contacts or staff notes, and
 *  medical notes only for swimmers in a class the instructor teaches or is
 *  covering today. No desk profile links. */
export async function findSiteSwimmers(query: string) {
  const session = await requireActivitiesAccess();
  if (!can(session, "attendance.mark")) throw new AuthorizationError("The swimmer lookup is for the pool deck.");
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const siteId = await currentClubId();
  const words = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const swimmers = await prisma.student.findMany({
    where: {
      enrolments: { some: { status: "ACTIVE", course: { clubId: siteId, archivedAt: null } } },
      AND: words.map((word) => ({ OR: [
        { firstName: { contains: word, mode: "insensitive" as const } },
        { lastName: { contains: word, mode: "insensitive" as const } },
      ] })),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 30,
    select: {
      id: true, firstName: true, lastName: true, dateOfBirth: true, medicalNotes: true,
      enrolments: {
        where: { status: "ACTIVE", course: { clubId: siteId, archivedAt: null } },
        select: { level: { select: { name: true } }, course: { select: { id: true, name: true, dayOfWeek: true, startMinutes: true, instructorId: true } } },
      },
    },
  });
  const courseIds = [...new Set(swimmers.flatMap((s) => s.enrolments.map((e) => e.course.id)))];
  const [covers, planned] = await Promise.all([
    prisma.classCover.findMany({ where: { courseId: { in: courseIds }, coverById: session.user.id, date: parseDateOnly(today()) }, select: { courseId: true } }),
    // Today's teacher on the rota's plan takes the class's usual instructor's place.
    plannedTeachers(courseIds, today()),
  ]);
  const coveringToday = new Set(covers.map((c) => c.courseId));
  const teachesToday = (course: { id: string; instructorId: string | null }) =>
    (planned.has(course.id) ? planned.get(course.id)!.teacherId : course.instructorId) === session.user.id;
  return swimmers.map((s) => {
    const teaching = s.enrolments.some((e) => teachesToday(e.course) || coveringToday.has(e.course.id));
    const { medicalNotes, hasMedicalNotes } = classifyMedical(s, teaching);
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      dateOfBirth: s.dateOfBirth,
      teaching,
      medicalNotes,
      hasMedicalNotes,
      places: s.enrolments.map((e) => ({ courseId: e.course.id, level: e.level.name, dayOfWeek: e.course.dayOfWeek, startMinutes: e.course.startMinutes, name: e.course.name })),
    };
  });
}
export type SiteSwimmer = Awaited<ReturnType<typeof findSiteSwimmers>>[number];
