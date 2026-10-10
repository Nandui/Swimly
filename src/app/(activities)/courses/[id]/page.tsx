import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ClassDetailView, classReturnHref, courseName, getClassCover, getCourse, getInstructorOptions, getLevelOptions, getRoster, getTransferTargets, scheduleHref, weekdayOfIso,
} from "@/modules/activities/features/courses";
import { CurriculumImage } from "@/modules/activities/features/curriculum";
import { can, canSee } from "@/lib/authz";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

/** The class name, as the H1 shows it (never its status tag). getCourse is
 *  cached per request, so the page below reuses this read. */
export async function generateMetadata(props: PageProps<"/courses/[id]">): Promise<Metadata> {
  await screenPage("courses");
  const course = await getCourse((await props.params).id);
  return { title: course ? courseName(course) : "Page not found" };
}

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
  const fromSchedule = params.from === "schedule" && canSee(session, "calendar");
  const iso = today();
  const [course, roster, targets, levels, instructors, cover] = await Promise.all([
    getCourse(id),
    getRoster(id),
    access.manage ? getTransferTargets(id) : Promise.resolve([]),
    access.admin ? getLevelOptions() : Promise.resolve([]),
    access.admin ? getInstructorOptions() : Promise.resolve([]),
    getClassCover(id, iso),
  ]);
  if (!course) notFound();
  return <ClassDetailView course={course} roster={roster} targets={targets} levels={levels} instructors={instructors}
    access={access} backHref={fromSchedule ? scheduleHref(params.date) : classReturnHref(params.returnTo)} backLabel={fromSchedule ? "Schedule" : "Classes"}
    coverName={!course.archivedAt && course.dayOfWeek === weekdayOfIso(iso) && cover?.coverById !== cover?.instructorId ? cover?.coverByName : undefined}
    levelImage={<CurriculumImage kind="level" id={course.levelId} name={course.level.name} />} />;
}
