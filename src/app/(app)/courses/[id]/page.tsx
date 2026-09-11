import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassDetailView } from "@/components/courses/class-detail";
import { CurriculumImage } from "@/components/curriculum/curriculum-image";
import { WrongClub } from "@/components/clubs/wrong-club";
import { can, canSee } from "@/lib/authz";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCurrentClub } from "@/lib/clubs/current";
import { classReturnHref } from "@/lib/courses/browse";
import { courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse, getInstructorOptions, getRoster } from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { getTransferTargets } from "@/lib/enrolment/data/enrolments";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Class" };

export default async function CoursePage(props: PageProps<"/courses/[id]">) {
  const session = await screenPage("courses");
  const access = {
    manage: can(session, "enrolment.manage"),
    admin: can(session, "courses.manage"),
    attendance: can(session, "attendance.mark"),
    students: canSee(session, "students"),
  };
  const { id } = await props.params;
  const params = await props.searchParams;
  const iso = today();
  const [course, roster, targets, levels, instructors, { club }, covers] = await Promise.all([
    getCourse(id),
    getRoster(id),
    access.manage ? getTransferTargets(id) : Promise.resolve([]),
    access.admin ? getLevelOptions() : Promise.resolve([]),
    access.admin ? getInstructorOptions() : Promise.resolve([]),
    getCurrentClub(),
    getCoversForDay(iso),
  ]);
  if (!course) notFound();
  if (course.clubId !== club.id) {
    return <WrongClub what={`The class ${courseName(course)} (${formatSlot(course)})`} owner={course.club} current={club} />;
  }

  return <ClassDetailView course={course} roster={roster} targets={targets} levels={levels} instructors={instructors}
    access={access} backHref={classReturnHref(params.returnTo)}
    coverName={!course.archivedAt && course.dayOfWeek === weekdayOfIso(iso) ? covers.get(id)?.coverByName : undefined}
    levelImage={<CurriculumImage kind="level" id={course.levelId} name={course.level.name} />} />;
}
