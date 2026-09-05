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
import { getCourses, getInstructorOptions, type CourseRow } from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { CourseFilters } from "@/components/courses/course-filters";
import {
  activeFilterCount,
  courseFilterDimensions,
  filterCourses,
  parseCourseFilters,
} from "@/lib/courses/filters";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Classes" };

export default async function CoursesPage(props: PageProps<"/courses">) {
  const session = await screenPage("courses");
  const admin = can(session, "courses.manage");

  // Opens on today. See `ANY_DAY` in filters.ts for how the week is reached.
  const iso = today();
  const todayDay = weekdayOfIso(iso);
  const filters = parseCourseFilters(await props.searchParams, todayDay);
  const active = activeFilterCount(filters);

  // Today's attendance state rides along, so a class that has been marked
  // today says so here the same way it does on Today.
  const [courses, levels, instructors, marked] = await Promise.all([
    getCourses(true),
    getLevelOptions(),
    getInstructorOptions(),
    getRegisterStateForDay(todayDay, iso),
  ]);

  const allLive = courses.filter((course) => !course.archivedAt);
  // Counted from the rows already in hand rather than asked for again. The
  // page reads the whole timetable regardless, so `getCourseCounts` was two
  // more round trips to a database in another country for two numbers already
  // sitting in memory.
  const counts = {
    courses: allLive.length,
    places: allLive.reduce((total, course) => total + course._count.enrolments, 0),
  };
  // Options are counted over the live timetable, because that is what the day
  // tables below show and what a count therefore has to predict.
  const dimensions = courseFilterDimensions(allLive, filters);

  const live = filterCourses(allLive, filters);
  const archived = filterCourses(
    courses.filter((course) => course.archivedAt),
    filters
  );
  const unassigned = live.filter((course) => !course.instructor).length;

  const add = admin ? <AddCourse levels={levels} instructors={instructors} /> : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
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

      <CourseFilters
        dimensions={dimensions}
        q={filters.q}
        active={active}
        showing={live.length}
        total={allLive.length}
      />

      {live.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={active > 0 ? "No classes match" : "No classes yet"}
          hint={
            active > 0
              ? "Loosen one of the filters, or clear them and start again."
              : "Add the first class — a level, a day, a time and how many fit in the water."
          }
          action={active > 0 ? null : add}
        />
      ) : (
        <div className="space-y-6">
          {DAYS_IN_ORDER.map((day) => {
            const onDay = live.filter((course) => course.dayOfWeek === day);
            if (onDay.length === 0) return null;
            return (
              <section key={day} className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">{DAY_META[day].label}</h2>
                <CourseTable
                  courses={onDay}
                  levels={levels}
                  instructors={instructors}
                  admin={admin}
                  marked={marked}
                  todayDay={todayDay}
                />
              </section>
            );
          })}
        </div>
      )}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Archived</h2>
          <CourseTable
            courses={archived}
            levels={levels}
            instructors={instructors}
            admin={admin}
            marked={marked}
            todayDay={todayDay}
            archived
          />
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
  marked,
  todayDay,
}: {
  courses: CourseRow[];
  levels: Awaited<ReturnType<typeof getLevelOptions>>;
  instructors: Awaited<ReturnType<typeof getInstructorOptions>>;
  admin: boolean;
  archived?: boolean;
  /** Which of today's classes have attendance in, and which day today is. */
  marked: Map<string, number>;
  todayDay: CourseRow["dayOfWeek"];
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
                  {!archived && course.dayOfWeek === todayDay && marked.has(course.id) ? (
                    <Tag color="green" className="ml-2">
                      Attendance taken
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
                <td className="px-3 py-2 text-muted-foreground tabular-nums md:whitespace-nowrap">
                  {capacityLabel(taken, course.capacity)}
                  {tone ? (
                    <Tag color={tone.color} className="ml-2">
                      {tone.label}
                    </Tag>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {admin ? (
                    <div className="flex items-center justify-end gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
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
