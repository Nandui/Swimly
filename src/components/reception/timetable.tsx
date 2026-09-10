"use client";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { capacityTone, courseLabel, courseName, formatTime } from "@/lib/courses/constants";
import { groupReceptionClasses, partitionReceptionClasses, receptionAvailability, RECEPTION_TIME_META, type ReceptionClass } from "@/lib/reception/timetable";
import type { ReceptionDashboardProps } from "./dashboard";
export function ReceptionTimetable({ courses, group, now, canOpen }: Pick<ReceptionDashboardProps, "courses" | "group" | "now"> & { canOpen: boolean }) {
  const { running, upcoming, earlier } = partitionReceptionClasses(courses, now);
  const groups = groupReceptionClasses(group === "time" ? [...running, ...upcoming] : courses, group);
  const nextStart = upcoming.length ? Math.min(...upcoming.map(course => course.startMinutes)) : null;
  const allFinished = earlier.length === courses.length;
  const renderGroup = (section: (typeof groups)[number], past = false) => {
    const isRunning = !past && section.courses.some(course => running.includes(course));
    const isNext = !past && section.courses.some(course => course.startMinutes === nextStart);
    const meta = group === "time" ? isRunning ? RECEPTION_TIME_META.running : isNext ? RECEPTION_TIME_META.next : null : null;
    // Different class lengths can share a start. Only show a common end when
    // every row actually finishes then; each row carries its own slot otherwise.
    const ends = new Set(section.courses.map(course => course.startMinutes + course.durationMinutes));
    const title = group === "time" && ends.size === 1 ? `${section.title}–${formatTime([...ends][0])}` : section.title;
    return <VStack gap={3} as="section" key={section.key} aria-label={title} className="min-w-0">
      <HStack gap={3} wrap="wrap" vAlign="center"><Heading level={3}>{title}</Heading>{meta ? <Tag color={meta.color}>{meta.label}</Tag> : null}</HStack>
      {section.description ? <Text color="secondary">{section.description}</Text> : null}
      <ClassRows courses={section.courses} canOpen={canOpen} showTime={group === "level" || ends.size > 1} />
    </VStack>;
  };
  return <VStack gap={6}>
    {allFinished ? <Text as="p" color="secondary">All of today’s classes have finished.</Text> : null}
    {groups.map(section => renderGroup(section))}
    {group === "time" && earlier.length ? (
      <Collapsible key={allFinished ? "finished" : "in-progress"} defaultIsOpen={allFinished}
        trigger={`Earlier today · ${earlier.length} ${earlier.length === 1 ? "class" : "classes"}`}>
        <VStack gap={6}>{groupReceptionClasses(earlier, "time").map(section => renderGroup(section, true))}</VStack>
      </Collapsible>
    ) : null}
  </VStack>;
}

function ClassRows({ courses, canOpen, showTime }: { courses: ReceptionClass[]; canOpen: boolean; showTime: boolean }) {
  return <List hasDividers density="compact" aria-label="Classes in this group">
    {courses.map(course => {
      const tone = capacityTone(course._count.enrolments, course.capacity);
      const teacher = course.coverName ?? course.instructor?.name ?? "Instructor not assigned";
      return <ListItem key={course.id} label={<Text weight="semibold">{courseName(course)}</Text>} description={
        <VStack gap={2} className="min-w-0 break-words">
          {course.name && course.name !== course.level.name ? <Text color="secondary">{course.level.name}</Text> : null}
          {showTime ? <Text hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text> : null}
          <Text color="secondary">{course.location ?? "Location not recorded"} · {teacher}</Text>
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Text color="secondary">{receptionAvailability(course._count.enrolments, course.capacity)}</Text>
            {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
            {course.coverName ? <Tag color={ATTENDANCE_RECORD_META.covered.color}>{ATTENDANCE_RECORD_META.covered.label}</Tag> : null}
          </HStack>
          {canOpen ? <HStack><Button label="Open class" href={`/courses/${course.id}`} variant="ghost" size="sm"
            aria-label={`Open ${courseLabel(course)}`} endContent={<Icon icon="chevronRight" size="sm" />} /></HStack> : null}
        </VStack>
      } />;
    })}
  </List>;
}
