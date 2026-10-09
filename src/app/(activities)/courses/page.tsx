import type { Metadata } from "next";
import { ClassBrowser, getCourses, getInstructorOptions, getLevelOptions, weekdayOfIso } from "@/modules/activities/features/courses";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
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
