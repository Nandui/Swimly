import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddCourse, ArchiveCourse, EditCourse } from "@/components/courses/course-actions";
import { can } from "@/lib/authz";
import {
  DAY_META,
  DAYS_IN_ORDER,
  capacityLabel,
  capacityTone,
  courseName,
  formatTime,
} from "@/lib/courses/constants";
import {
  getCourseCounts,
  getCourses,
  getInstructorOptions,
  type CourseRow,
} from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const session = await pageSession();
  const admin = can(session, "courses.manage");

  const [courses, counts, levels, instructors] = await Promise.all([
    getCourses(true),
    getCourseCounts(),
    getLevelOptions(),
    getInstructorOptions(),
  ]);

  const live = courses.filter((course) => !course.archivedAt);
  const archived = courses.filter((course) => course.archivedAt);
  const unassigned = live.filter((course) => !course.instructor).length;

  const add = admin ? <AddCourse levels={levels} instructors={instructors} /> : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="The timetable: one class, one time, every week."
        actions={add}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{counts.courses}</span>{" "}
        {counts.courses === 1 ? "class" : "classes"} across the week, holding{" "}
        <span className="font-medium text-foreground tabular-nums">{counts.places}</span>{" "}
        {counts.places === 1 ? "swimmer" : "swimmers"}.
        {unassigned > 0 ? (
          <>
            {" "}
            <span className="font-medium text-(--tag-orange-fg) tabular-nums">{unassigned}</span>{" "}
            {unassigned === 1 ? "has" : "have"} nobody assigned to teach{" "}
            {unassigned === 1 ? "it" : "them"}.
          </>
        ) : null}
      </p>

      {live.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No courses yet"
          hint="Add the first class — a level, a day, a time and how many fit in the water."
          action={add}
        />
      ) : (
        <div className="space-y-6">
          {DAYS_IN_ORDER.map((day) => {
            const onDay = live.filter((course) => course.dayOfWeek === day);
            if (onDay.length === 0) return null;
            return (
              <section key={day} className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">{DAY_META[day].label}</h2>
                <CourseTable courses={onDay} levels={levels} instructors={instructors} admin={admin} />
              </section>
            );
          })}
        </div>
      )}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Archived</h2>
          <CourseTable courses={archived} levels={levels} instructors={instructors} admin={admin} archived />
        </section>
      ) : null}
    </div>
  );
}

function CourseTable({
  courses,
  levels,
  instructors,
  admin,
  archived,
}: {
  courses: CourseRow[];
  levels: Awaited<ReturnType<typeof getLevelOptions>>;
  instructors: Awaited<ReturnType<typeof getInstructorOptions>>;
  admin: boolean;
  archived?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Class
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Time
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-lg:hidden"
            >
              Instructor
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Places
            </th>
            <th scope="col" className="w-20 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const taken = course._count.enrolments;
            const tone = capacityTone(taken, course.capacity);
            return (
              <tr
                key={course.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link href={`/courses/${course.id}`} className="underline-offset-2 hover:underline">
                    {courseName(course)}
                  </Link>
                  {archived ? (
                    <Tag color="gray" className="ml-2">
                      Archived
                    </Tag>
                  ) : null}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {course.level.programme.name} · {course.level.name}
                    {course.location ? ` · ${course.location}` : ""}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {DAY_META[course.dayOfWeek].short} {formatTime(course.startMinutes)}
                    {course.instructor ? ` · ${course.instructor.name}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums max-md:hidden">
                  {formatTime(course.startMinutes)}–
                  {formatTime(course.startMinutes + course.durationMinutes)}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-lg:hidden">
                  {course.instructor?.name ?? (
                    <span className="text-(--tag-orange-fg)">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                  {capacityLabel(taken, course.capacity)}
                  {tone ? (
                    <Tag color={tone.color} className="ml-2">
                      {tone.label}
                    </Tag>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {admin ? (
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                      <EditCourse course={course} levels={levels} instructors={instructors} />
                      <ArchiveCourse course={course} />
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
