import type { ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { AddCourse } from "./course-actions";
import { CourseFilters } from "./course-filters";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { capacityLabel, capacityTone, courseLabel, courseName, DAY_META, formatTime } from "@/lib/courses/constants";
import { CLASS_PAGE_SIZE, classBrowserHref, classBrowserModel, classDetailsHref } from "@/lib/courses/browse";
import { activeFilterCount, courseFilterDimensions } from "@/lib/courses/filters";
import type { CourseRow, InstructorOption } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";

/** One flat result table. Opening a class preserves this exact search as its
 *  breadcrumb destination; no roster is downloaded by the browser page. */
export function ClassBrowser({ courses, params, todayDay, marked, covers, levels, instructors, canManage, images = {} }: {
  courses: CourseRow[];
  params: Record<string, string | string[] | undefined>;
  todayDay: CourseRow["dayOfWeek"];
  marked: Map<string, number>;
  covers: Map<string, { coverByName: string }>;
  levels: LevelOption[];
  instructors: InstructorOption[];
  canManage: boolean;
  images?: Record<string, ReactNode>;
}) {
  const model = classBrowserModel(courses, params);
  const { filters, state, collection, rows, matches, page, returnTo } = model;
  const active = activeFilterCount(filters);
  const query = Object.fromEntries(new URLSearchParams(returnTo.split("?")[1]));
  return <VStack gap={5}>
    <PageHeader title="Classes" description="Find a weekly class, see its details and check who is enrolled."
      actions={canManage ? <AddCourse levels={levels} instructors={instructors} /> : undefined} />
    <HStack>
      <LinkSegments label="Class status" value={state} options={[
        { value: "active", label: `Active (${model.activeCount})`, href: classBrowserHref(params, { state: null, page: null }) },
        { value: "archived", label: `Archived (${model.archivedCount})`, href: classBrowserHref(params, { state: "archived", page: null }) },
      ]} />
    </HStack>
    <CourseFilters dimensions={courseFilterDimensions(collection, filters)} q={filters.q} active={active}
      showing={matches.length} total={collection.length} state={state} todayDay={todayDay} />
    {rows.length ? <>
      <Table hasHover textOverflow="wrap" aria-label="Weekly classes" className="table-fixed">
        <TableHeader><TableRow isHeaderRow>
          <TableHeaderCell scope="col">Class</TableHeaderCell>
          <TableHeaderCell scope="col" className="hidden md:table-cell">Day &amp; time</TableHeaderCell>
          <TableHeaderCell scope="col" className="hidden lg:table-cell">Instructor</TableHeaderCell>
          <TableHeaderCell scope="col" className="hidden md:table-cell">Places</TableHeaderCell>
          <TableHeaderCell scope="col" className="w-32 max-w-none"><Text className="sr-only">Inspect class</Text></TableHeaderCell>
        </TableRow></TableHeader>
        <TableBody>{rows.map(course => {
          const taken = course._count.enrolments;
          const tone = capacityTone(taken, course.capacity);
          const cover = !course.archivedAt && course.dayOfWeek === todayDay ? covers.get(course.id) : undefined;
          const time = `${DAY_META[course.dayOfWeek].short} ${formatTime(course.startMinutes)}–${formatTime(course.startMinutes + course.durationMinutes)}`;
          return <TableRow key={course.id}>
            <TableCell><VStack gap={1}>
              <HStack gap={2} vAlign="center" wrap="wrap">{images[course.levelId]}<Text weight="semibold">{courseName(course)}</Text></HStack>
              <Text color="secondary">{course.level.programme.name}{course.name && course.name !== course.level.name ? ` · ${course.level.name}` : ""}</Text>
              <Text color="secondary">{course.location ?? "Pool area not recorded"}</Text>
              <Text hasTabularNumbers className="md:hidden">{time}</Text>
              <Text color="secondary" className="lg:hidden">{cover ? `${cover.coverByName} (cover today)` : course.instructor?.name ?? "Instructor not assigned"}</Text>
              <Text color="secondary" className="md:hidden">{capacityLabel(taken, course.capacity)}{course.capacity === null ? " · No capacity limit" : " enrolled"}</Text>
              <HStack gap={2} wrap="wrap">
                {course.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>Archived</Tag> : null}
                {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
                {!course.archivedAt && course.dayOfWeek === todayDay && marked.has(course.id) ? <Tag color={ATTENDANCE_RECORD_META.taken.color}>{ATTENDANCE_RECORD_META.taken.label}</Tag> : null}
              </HStack>
            </VStack></TableCell>
            <TableCell className="hidden md:table-cell"><Text hasTabularNumbers>{time}</Text></TableCell>
            <TableCell className="hidden lg:table-cell"><VStack gap={1}>
              <Text>{course.instructor?.name ?? "Instructor not assigned"}</Text>
              {cover ? <Text color="secondary">{cover.coverByName} · cover today</Text> : null}
            </VStack></TableCell>
            <TableCell className="hidden md:table-cell"><VStack gap={1}>
              <Text hasTabularNumbers>{capacityLabel(taken, course.capacity)}</Text>
              <Text color="secondary">{course.capacity === null ? "No capacity limit" : `${Math.max(0, course.capacity - taken)} available`}</Text>
            </VStack></TableCell>
            <TableCell><Button href={classDetailsHref(course.id, returnTo)} label="View class" aria-label={`View ${courseLabel(course)}`} variant="secondary" /></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      {matches.length > CLASS_PAGE_SIZE ? <LinkPagination label="Class pages" page={page} totalItems={matches.length} pageSize={CLASS_PAGE_SIZE} pathname="/courses" query={query} /> : null}
    </> : <EmptyState title={active ? "No classes match" : state === "archived" ? "No archived classes" : "No classes yet"}
      hint={active ? "Try another day, level or pool area, or reset the filters." : state === "archived" ? "Archived classes will appear here, with their details and places kept on record." : canManage ? "Choose Add class to create the first weekly class." : "No weekly classes are available in this club yet."}
      action={active ? <Button label="Reset filters" href={state === "archived" ? "/courses?state=archived" : "/courses"} /> : undefined} />}
  </VStack>;
}
