import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddCourse, ArchiveCourse, EditCourse } from "@/components/courses/course-actions";
import { CourseFilters } from "@/components/courses/course-filters";
import { can } from "@/lib/authz";
import { COURSE_STATUS_META,
  DAY_META,
  DAYS_IN_ORDER,
  capacityLabel,
  capacityTone,
  courseName,
  formatTime,
} from "@/lib/courses/constants";
import { getCourses, getInstructorOptions, type CourseRow } from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
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
    admin ? getLevelOptions() : Promise.resolve([]),
    admin ? getInstructorOptions() : Promise.resolve([]),
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
    <VStack gap={6}>
      <PageHeader
        title="Classes"
        description="The timetable: one class, one time, every week."
        actions={add}
      />

      <Lead>
        <Num>{counts.courses}</Num> {counts.courses === 1 ? "class" : "classes"} across the week,
        holding <Num>{counts.places}</Num> {counts.places === 1 ? "swimmer" : "swimmers"}.
        {unassigned > 0 ? (
          <>
            {" "}
            <Alert>{unassigned}</Alert> {unassigned === 1 ? "has" : "have"} nobody assigned to
            teach {unassigned === 1 ? "it" : "them"}.
          </>
        ) : null}
      </Lead>

      <CourseFilters
        dimensions={dimensions}
        q={filters.q}
        active={active}
        showing={live.length}
        total={allLive.length}
      />

      {live.length === 0 ? (
        <EmptyState
          icon="calendarDays"
          title={active > 0 ? "No classes match" : "No classes yet"}
          hint={
            active > 0
              ? "Loosen one of the filters, or clear them and start again."
              : "Add the first class — a level, a day, a time and how many fit in the water."
          }
          action={active > 0 ? null : add}
        />
      ) : (
        <VStack gap={6}>
          {DAYS_IN_ORDER.map((day) => {
            const onDay = live.filter((course) => course.dayOfWeek === day);
            if (onDay.length === 0) return null;
            return (
              <VStack key={day} gap={3} as="section">
                <Heading level={2}>{DAY_META[day].label}</Heading>
                <CourseTable
                  courses={onDay}
                  levels={levels}
                  instructors={instructors}
                  admin={admin}
                  marked={marked}
                  todayDay={todayDay}
                />
              </VStack>
            );
          })}
        </VStack>
      )}

      {archived.length > 0 ? (
        <VStack gap={3} as="section">
          <Heading level={2}>Archived</Heading>
          <CourseTable
            courses={archived}
            levels={levels}
            instructors={instructors}
            admin={admin}
            marked={marked}
            todayDay={todayDay}
            archived
          />
        </VStack>
      ) : null}
    </VStack>
  );
}

/** The day's classes as rows. Below `md` the time and the instructor leave
 *  their columns and re-home as a supporting line under the name. */
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
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Class</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Time
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-lg:hidden">
            Instructor
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">Places</TableHeaderCell>
          {admin ? (
            <TableHeaderCell scope="col">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => {
          const taken = course._count.enrolments;
          const tone = capacityTone(taken, course.capacity);
          return (
            <TableRow key={course.id}>
              <TableCell>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Link href={`/courses/${course.id}`} weight="medium">
                    {courseName(course)}
                  </Link>
                  {archived ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                  {!archived && course.dayOfWeek === todayDay && marked.has(course.id) ? (
                    <Tag color={ATTENDANCE_RECORD_META.taken.color}>{ATTENDANCE_RECORD_META.taken.label}</Tag>
                  ) : null}
                </HStack>
                <Text type="supporting" display="block">
                  {course.level.programme.name} · {course.level.name}
                  {course.location ? ` · ${course.location}` : ""}
                </Text>
                <Text type="supporting" display="block" className="md:hidden">
                  {DAY_META[course.dayOfWeek].short} {formatTime(course.startMinutes)}–
                  {formatTime(course.startMinutes + course.durationMinutes)}
                </Text>
                <Text type="supporting" display="block" className="lg:hidden">
                  {course.instructor?.name ?? COURSE_STATUS_META.unassigned.label}
                </Text>
                <HStack gap={2} vAlign="center" wrap="wrap" className="md:hidden">
                  <Text type="supporting" hasTabularNumbers>
                    {capacityLabel(taken, course.capacity)}
                  </Text>
                  {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
                </HStack>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" hasTabularNumbers textWrap="nowrap">
                  {formatTime(course.startMinutes)}–
                  {formatTime(course.startMinutes + course.durationMinutes)}
                </Text>
              </TableCell>
              <TableCell className="max-lg:hidden">
                {course.instructor ? (
                  <Text color="secondary">{course.instructor.name}</Text>
                ) : (
                  <Tag color={COURSE_STATUS_META.unassigned.color}>{COURSE_STATUS_META.unassigned.label}</Tag>
                )}
              </TableCell>
              <TableCell className="max-md:hidden">
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text color="secondary" hasTabularNumbers textWrap="nowrap">
                    {capacityLabel(taken, course.capacity)}
                  </Text>
                  {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
                </HStack>
              </TableCell>
              {admin ? (
                <TableCell>
                  <HStack gap={1} vAlign="center" hAlign="end" wrap="wrap">
                    <EditCourse course={course} levels={levels} instructors={instructors} />
                    <ArchiveCourse course={course} />
                  </HStack>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
