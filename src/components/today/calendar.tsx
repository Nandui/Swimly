"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { capacityLabel, capacityTone, courseName, formatTime, placesLeft } from "@/lib/courses/constants";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { CALENDAR_PHASE_META, calendarClassHref, calendarSlots, classPhase, filterCalendarClasses, type CalendarClass } from "@/lib/today/calendar";

type Access = { attendance: boolean; courses: boolean };

/** One job: see the day's classes. Time columns wrap in reading order instead
 * of shrinking their text or hiding the rest of the day behind horizontal scroll. */
export function TodayCalendar({ courses, iso, initialNow, clubName, me, access }: {
  courses: CalendarClass[]; iso: string; initialNow: number; clubName: string; me: string; access: Access;
}) {
  const router = useRouter();
  const [location, setLocation] = useState("all");
  const [instructor, setInstructor] = useState("all");
  const [now, setNow] = useState(initialNow);
  const [dateChanged, setDateChanged] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "visible") return;
      const instant = new Date();
      setNow(minutesNow(instant));
      setDateChanged(today(instant) !== iso);
      // Do not replace an open picker while staff are choosing a filter.
      if (!document.querySelector('[role="listbox"]')) router.refresh();
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [iso, router]);

  const shown = filterCalendarClasses(courses, location, instructor, me);
  const slots = calendarSlots(shown, now);
  const running = shown.filter(course => classPhase(course, now) === "running").length;
  const later = shown.filter(course => classPhase(course, now) === "later").length;
  const target = slots.find(slot => slot.phase === "running") ?? slots.find(slot => slot.phase === "next");
  const locations = [...new Set(courses.map(course => course.location ?? ""))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const people = new Map<string, string>();
  for (const course of courses) {
    if (course.instructor) people.set(course.instructor.id, course.instructor.name);
    if (course.cover?.coverById) people.set(course.cover.coverById, course.cover.coverByName);
  }
  const filtered = location !== "all" || instructor !== "all";
  const reset = () => { setLocation("all"); setInstructor("all"); };
  const refresh = () => {
    const instant = new Date();
    setNow(minutesNow(instant));
    setDateChanged(today(instant) !== iso);
    startRefresh(() => router.refresh());
  };
  const jump = () => {
    if (!target) return;
    const heading = document.getElementById(`time-${target.start}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  return <VStack gap={5}>
    <PageHeader title="Today’s classes"
      description={`${new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(parseDateOnly(iso))}, ${formatDate(parseDateOnly(iso))} · ${clubName}`}
      actions={<>
        {target && !dateChanged ? <Button label={running ? "Jump to now" : "Jump to next"} variant="secondary" onClick={jump} /> : null}
        <Button label="Refresh" variant="ghost" icon={<Icon icon={RefreshCw} size="sm" />} onClick={refresh} isLoading={refreshing} />
      </>} />

    <HStack gap={4} wrap="wrap" vAlign="end" hAlign="between">
      <HStack gap={3} wrap="wrap" className="max-sm:w-full">
        <Selector label="Pool area" value={location} onChange={setLocation} hasSearch={locations.length > 8}
          className="w-48 max-sm:w-full" options={[{ value: "all", label: "All pool areas" },
            ...locations.map(value => ({ value, label: value || "Location not set" }))]} />
        <Selector label="Instructor" value={instructor} onChange={setInstructor} hasSearch
          className="w-56 max-sm:w-full" options={[{ value: "all", label: "All instructors" }, { value: "mine", label: "My classes" },
            ...[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))]} />
        {filtered ? <Button label="Clear filters" variant="ghost" onClick={reset} /> : null}
      </HStack>
      <Text color="secondary" role="status" aria-live="polite" hasTabularNumbers>
        {filtered ? `${shown.length} of ${courses.length} classes` : `${courses.length} ${courses.length === 1 ? "class" : "classes"}`}
        {running > 0 ? ` · ${running} running now` : ""}{later > 0 ? ` · ${later} later` : ""}
      </Text>
    </HStack>

    {dateChanged ? <EmptyState icon="calendarCheck" title="A new day has started" hint="Refresh to load today’s classes." action={<Button label="Load today" onClick={refresh} isLoading={refreshing} />} />
      : shown.length === 0 ? <EmptyState icon="calendarCheck" title={courses.length ? "No classes match these filters" : "No classes today"}
        hint={courses.length ? "Clear the filters to see the full day." : "There are no weekly classes scheduled at this pool today."}
        action={filtered ? <Button label="Show all classes" onClick={reset} /> : undefined} />
        : <VStack gap={3}>
          <Text color="secondary">Classes by start time</Text>
          <Grid columns={{ minWidth: 248, repeat: "fit" }} gap={4} align="stretch" aria-label="Today’s class calendar">
            {slots.map(slot => {
              const phase = CALENDAR_PHASE_META[slot.phase];
              return <VStack key={slot.start} gap={0} as="section" aria-labelledby={`time-${slot.start}`} className="min-w-0">
                <Section variant="muted" padding={3} dividers={["bottom"]}>
                  <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                    <Heading level={2} id={`time-${slot.start}`} tabIndex={-1} className="scroll-mt-4">
                      {formatTime(slot.start)}
                    </Heading>
                    {slot.phase !== "later" ? <Tag color={phase.color}>{phase.label}</Tag> : null}
                  </HStack>
                  <Text color="secondary" hasTabularNumbers>{slot.classes.length} {slot.classes.length === 1 ? "class" : "classes"}</Text>
                </Section>
                <Section padding={0} height="100%">
                  <List hasDividers aria-label={`Classes starting at ${formatTime(slot.start)}`}>
                    {slot.classes.map(course => <CalendarEntry key={course.id} course={course} now={now} iso={iso} access={access} />)}
                  </List>
                </Section>
              </VStack>;
            })}
          </Grid>
        </VStack>}
  </VStack>;
}

function CalendarEntry({ course, now, iso, access }: { course: CalendarClass; now: number; iso: string; access: Access }) {
  const phase = classPhase(course, now);
  const name = courseName(course);
  const href = calendarClassHref(course.id, iso, access);
  const tone = capacityTone(course.enrolled, course.capacity);
  const free = placesLeft(course.enrolled, course.capacity);
  const attendance = course.attendanceTaken ? ATTENDANCE_RECORD_META.taken : phase === "finished" ? ATTENDANCE_RECORD_META.notTaken : null;
  return <Item as="li" density="spacious" href={href}
    aria-label={href ? `${access.attendance ? "Open attendance" : "Open class"}: ${name}, ${formatTime(course.startMinutes)}, ${course.location || "location not set"}` : undefined}
    label={<HStack gap={2} hAlign="between" vAlign="start">
      <Text weight="semibold" className="break-words">
        {href ? <VisuallyHidden>{access.attendance ? "Open attendance: " : "Open class: "}</VisuallyHidden> : null}
        {name}
      </Text>
      {href ? <Icon icon="chevronRight" size="sm" /> : null}
    </HStack>}
    description={<VStack gap={2} paddingBlockStart={2}>
      {name !== course.level.name ? <Text color="secondary">{course.level.name}</Text> : null}
      <Text color="secondary" hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text>
      <VStack gap={1}>
        <Text>{course.location || "Location not set"}</Text>
        <Text color="secondary" className="break-words">{course.cover ? `${course.cover.coverByName} · Cover` : course.instructor?.name || "No instructor assigned"}</Text>
      </VStack>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Text color="secondary" hasTabularNumbers>{capacityLabel(course.enrolled, course.capacity)}</Text>
        {tone ? <Tag color={tone.color}>{tone.label}</Tag> : free !== null ? <Text color="secondary">{free} free</Text> : null}
      </HStack>
      <HStack gap={2} wrap="wrap">
        {phase === "running" ? <Tag color={CALENDAR_PHASE_META.running.color}>{CALENDAR_PHASE_META.running.label}</Tag> : null}
        {attendance ? <Tag color={attendance.color}>{attendance.label}</Tag> : null}
      </HStack>
    </VStack>} />;
}
