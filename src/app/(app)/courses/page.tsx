import type { Metadata } from "next";
import { ClassBrowser } from "@/components/courses/class-browser";
import { CurriculumImage } from "@/components/curriculum/curriculum-image";
import { can } from "@/lib/authz";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { classBrowserModel } from "@/lib/courses/browse";
import { getCourses, getInstructorOptions } from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Classes" };

export default async function CoursesPage(props: PageProps<"/courses">) {
  const session = await screenPage("courses");
  const canManage = can(session, "courses.manage");
  const params = await props.searchParams;
  const iso = today();
  const todayDay = weekdayOfIso(iso);
  const [courses, levels, instructors, marked, covers] = await Promise.all([
    getCourses(true),
    canManage ? getLevelOptions() : Promise.resolve([]),
    canManage ? getInstructorOptions() : Promise.resolve([]),
    getRegisterStateForDay(todayDay, iso),
    getCoversForDay(iso),
  ]);
  const images = Object.fromEntries(classBrowserModel(courses, params).rows.map(course => [
    course.levelId,
    <CurriculumImage key={course.levelId} kind="level" id={course.levelId} name={course.level.name} />,
  ]));

  return <ClassBrowser courses={courses} params={params} todayDay={todayDay} marked={marked}
    covers={covers} levels={levels} instructors={instructors} canManage={canManage} images={images} />;
}
