import type { Metadata } from "next";
import { ClassBrowser } from "@/components/courses/class-browser";
import { can } from "@/lib/authz";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCurrentClub } from "@/lib/clubs/current";
import { getCourses, getInstructorOptions } from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Classes" };

export default async function CoursesPage(props: PageProps<"/courses">) {
  const session = await screenPage("courses");
  const canManage = can(session, "courses.manage");
  const [courses, levels, instructors, { club }, params] = await Promise.all([
    getCourses(true, true),
    canManage ? getLevelOptions() : Promise.resolve([]),
    canManage ? getInstructorOptions() : Promise.resolve([]),
    getCurrentClub(), props.searchParams,
  ]);
  return <ClassBrowser courses={courses} params={params} todayDay={weekdayOfIso(today())}
    levels={levels} instructors={instructors} canManage={canManage} workingSite={club.name} />;
}
