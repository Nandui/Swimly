import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ClassDetailView, classReturnHref, courseName, getClassCover, getCourse, getLevelOptions, getRoster, getTransferTargets, nextLessonTeacher, scheduleHref, weekdayOfIso,
} from "@/modules/activities/features/courses";
import { CurriculumImage } from "@/modules/activities/features/curriculum";
import { can, canSee } from "@/lib/authz";
import { formatDay, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";

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
  const [course, roster, targets, levels, cover, sites] = await Promise.all([
    getCourse(id),
    getRoster(id),
    access.manage ? getTransferTargets(id) : Promise.resolve([]),
    access.admin ? getLevelOptions() : Promise.resolve([]),
    getClassCover(id, iso),
    access.admin ? getCurrentClub().then((current) => current.clubs) : Promise.resolve([]),
  ]);
  if (!course) notFound();
  const next = course.archivedAt ? null : await nextLessonTeacher(course, iso);
  return <ClassDetailView course={course} roster={roster} targets={targets} levels={levels} sites={sites} nextTeacher={next ? { day: next.iso === iso ? "Today" : formatDay(next.iso), name: next.name, planned: next.planned } : undefined}
    planHref={next && canSee(session, "rota") ? `/rota?${new URLSearchParams({ site: course.clubId, day: next.iso })}` : undefined}
    access={access} backHref={fromSchedule ? scheduleHref(params.date) : classReturnHref(params.returnTo)} backLabel={fromSchedule ? "Schedule" : "Classes"}
    coverName={!course.archivedAt && course.dayOfWeek === weekdayOfIso(iso) && cover?.coverById !== cover?.instructorId ? cover?.coverByName : undefined}
    levelImage={<CurriculumImage kind="level" id={course.levelId} name={course.level.name} />} />;
}
