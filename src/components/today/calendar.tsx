"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { capacityLabel, capacityTone, courseName, formatTime, placesLeft } from "@/lib/courses/constants";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { CALENDAR_PHASE_META, calendarClassHref, calendarProgrammes, calendarSlots, classPhase, filterCalendarClasses, type CalendarClass } from "@/lib/today/calendar";

type Access = { attendance: boolean; courses: boolean };

type Slot = ReturnType<typeof calendarSlots>[number];

/** The booking sheet has a level stub and readable time columns. Measure the
 * working surface (including sidebar changes), not the viewport. Structural
 * budgets: 144px for levels, at least 160px per time. Below 640px use a schedule.
 * Extra starts continue in another sheet below; nothing is paginated or hidden. */
export function TodayCalendar({ courses, iso, initialNow, clubName, me, access }: {
  courses: CalendarClass[]; iso: string; initialNow: number; clubName: string; me: string; access: Access;
}) {
  const router = useRouter();
  const [location, setLocation] = useState("all");
  const [instructor, setInstructor] = useState("all");
  const [now, setNow] = useState(initialNow);
  const [dateChanged, setDateChanged] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const surface = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
  const programmes = calendarProgrammes(shown);
  const columns = Math.max(1, Math.floor((width - 144) / 160));
  const bands = Array.from({ length: Math.ceil(slots.length / columns) }, (_, index) => slots.slice(index * columns, (index + 1) * columns));
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

  return <VStack ref={surface} gap={4} className="min-w-0">
    <PageHeader title="Today’s classes"
      description={`${new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(parseDateOnly(iso))}, ${formatDate(parseDateOnly(iso))} · ${clubName}`}
      actions={<HStack gap={3} wrap="wrap" vAlign="end">
        <Selector label="Pool area" value={location} onChange={setLocation} hasSearch={locations.length > 8}
          className="w-48 max-sm:w-full" options={[{ value: "all", label: "All pool areas" },
            ...locations.map(value => ({ value, label: value || "Location not set" }))]} />
        <Selector label="Instructor" value={instructor} onChange={setInstructor} hasSearch
          className="w-56 max-sm:w-full" options={[{ value: "all", label: "All instructors" }, { value: "mine", label: "My classes" },
            ...[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))]} />
        {filtered ? <Button label="Clear filters" variant="ghost" onClick={reset} /> : null}
        {target && !dateChanged ? <Button label={running ? "Jump to now" : "Jump to next"} variant="secondary" onClick={jump} /> : null}
        <Button label="Refresh" variant="ghost" icon={<Icon icon={RefreshCw} size="sm" />} onClick={refresh} isLoading={refreshing} />
      </HStack>} />

    <VisuallyHidden role="status" aria-live="polite">
        {filtered ? `${shown.length} of ${courses.length} classes` : `${courses.length} ${courses.length === 1 ? "class" : "classes"}`}
        {running > 0 ? ` · ${running} running now` : ""}{later > 0 ? ` · ${later} later` : ""}
    </VisuallyHidden>

    {dateChanged ? <EmptyState icon="calendarCheck" title="A new day has started" hint="Refresh to load today’s classes." action={<Button label="Load today" onClick={refresh} isLoading={refreshing} />} />
      : shown.length === 0 ? <EmptyState icon="calendarCheck" title={courses.length ? "No classes match these filters" : "No classes today"}
        hint={courses.length ? "Clear the filters to see the full day." : "There are no weekly classes scheduled at this pool today."}
        action={filtered ? <Button label="Show all classes" onClick={reset} /> : undefined} />
        : width < 640 ? <VStack gap={4} aria-label="Today’s class schedule">
          {slots.map(slot => <VStack key={slot.start} gap={0} as="section" aria-labelledby={`time-${slot.start}`}>
            <Section variant="muted" padding={3} dividers={["bottom"]}>
              <TimeHeading slot={slot} />
            </Section>
            <List hasDividers aria-label={`Classes starting at ${formatTime(slot.start)}`}>
              {slot.classes.map(course => <CalendarEntry key={course.id} course={course} now={now} iso={iso} access={access} />)}
            </List>
          </VStack>)}
        </VStack> : <VStack gap={6} aria-label="Today’s class calendar">
          {bands.map(band => <VStack key={band[0].start} gap={2}>
            {bands.length > 1 ? <Text color="secondary" hasTabularNumbers>
              {`Start times ${formatTime(band[0].start)}${band.length > 1 ? `–${formatTime(band[band.length - 1].start)}` : ""}`}
            </Text> : null}
            <Table density="compact" dividers="grid" verticalAlign="top" className="w-full table-fixed"
              aria-label={`Today’s booking sheet, start times ${formatTime(band[0].start)} to ${formatTime(band[band.length - 1].start)}`}>
              {/* Astryx's children mode has no column component. Native colgroup
                  sets the structural stub width without restyling its cells. */}
              <colgroup><col className="w-36" />{band.map(slot => <col key={slot.start} />)}</colgroup>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHeaderCell scope="col" className="align-top"><Text weight="semibold">Level</Text></TableHeaderCell>
                  {band.map(slot => <TableHeaderCell key={slot.start} scope="col" id={`column-${slot.start}`} className="align-top">
                    <TimeHeading slot={slot} />
                  </TableHeaderCell>)}
                </TableRow>
              </TableHeader>
              {programmes.map(({ programme, levels }) => {
                const rows = levels.filter(row => band.some(slot => row.starts.has(slot.start)));
                if (!rows.length) return null;
                const groupId = `programme-${programme.id}-${band[0].start}`;
                return <TableBody key={programme.id} aria-labelledby={groupId}>
                  <TableRow>
                    <TableCell colSpan={band.length + 1} className="p-0">
                      <Section variant="muted" padding={2} paddingInline={3}>
                        <Heading level={4} accessibilityLevel={2} color="secondary" id={groupId}>{programme.name}</Heading>
                      </Section>
                    </TableCell>
                  </TableRow>
                  {rows.map(({ level, starts }) => {
                    const rowId = `level-${level.id}-${band[0].start}`;
                    return <TableRow key={level.id}>
                      <TableHeaderCell scope="row" id={rowId} className="whitespace-normal bg-muted">
                        <Text size="lg" weight="semibold" textWrap="wrap" className="break-words">{level.name}</Text>
                      </TableHeaderCell>
                      {band.map(slot => {
                        const classes = starts.get(slot.start);
                        return <TableCell key={slot.start} headers={`${rowId} column-${slot.start}`} className="p-0">
                          {classes ? <List hasDividers aria-label={`${level.name}, ${formatTime(slot.start)}`}>
                            {classes.map(course => <CalendarEntry key={course.id} course={course} now={now} iso={iso} access={access} sheet />)}
                          </List> : <VStack padding={3}><Text color="secondary">No class</Text></VStack>}
                        </TableCell>;
                      })}
                    </TableRow>;
                  })}
                </TableBody>;
              })}
            </Table>
          </VStack>)}
        </VStack>}
  </VStack>;
}

function TimeHeading({ slot }: { slot: Slot }) {
  const phase = CALENDAR_PHASE_META[slot.phase];
  return <VStack gap={1} paddingBlock={1} hAlign="start">
    <Heading level={3} accessibilityLevel={2} id={`time-${slot.start}`} tabIndex={-1} className="scroll-mt-4">{formatTime(slot.start)}</Heading>
    <Text color="secondary" hasTabularNumbers>{slot.classes.length} {slot.classes.length === 1 ? "class" : "classes"}</Text>
    {slot.phase !== "later" ? <Tag color={phase.color}>{phase.label}</Tag> : null}
  </VStack>;
}

function CalendarEntry({ course, now, iso, access, sheet = false }: { course: CalendarClass; now: number; iso: string; access: Access; sheet?: boolean }) {
  const phase = classPhase(course, now);
  const name = courseName(course);
  const href = calendarClassHref(course.id, iso, access);
  const tone = capacityTone(course.enrolled, course.capacity);
  const free = placesLeft(course.enrolled, course.capacity);
  const location = course.location || "Location not set";
  const customName = name !== course.level.name;
  const attendance = course.attendanceTaken ? ATTENDANCE_RECORD_META.taken : phase === "finished" ? ATTENDANCE_RECORD_META.notTaken : null;
  return <Item as="li" density={sheet ? "balanced" : "spacious"} href={href} className="min-w-0"
    aria-label={href ? `${access.attendance ? "Open attendance" : "Open class"}: ${name}, ${formatTime(course.startMinutes)}, ${course.location || "location not set"}` : undefined}
    label={<HStack gap={2} hAlign="between" vAlign="start">
      <Text weight="semibold" className="break-words">
        {href ? <VisuallyHidden>{`${access.attendance ? "Open attendance" : "Open class"}: ${sheet ? `${name}, ${formatTime(course.startMinutes)}, ` : ""}`}</VisuallyHidden> : null}
        {sheet ? location : name}
      </Text>
      {href && !sheet ? <Icon icon="chevronRight" size="sm" /> : null}
    </HStack>}
    description={<VStack gap={sheet ? 0 : 1} paddingBlockStart={sheet ? 0 : 1}>
      {customName ? <Text color="secondary" className="break-words">{sheet ? name : course.level.name}</Text> : null}
      {!sheet ? <Text>{location}</Text> : null}
      <Text color="secondary" className="break-words">{course.cover ? `${course.cover.coverByName} · Cover` : course.instructor?.name || "No instructor assigned"}</Text>
      <Text color="secondary" hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text>
      <HStack gap={1} wrap="wrap" vAlign="center">
        <Text color="secondary" hasTabularNumbers>{capacityLabel(course.enrolled, course.capacity)}</Text>
        {tone ? <Tag color={tone.color}>{tone.label}</Tag> : free !== null ? <Text color="secondary">· {free} free</Text> : null}
      </HStack>
      <HStack gap={1} wrap="wrap">
        {phase === "running" ? <Tag color={CALENDAR_PHASE_META.running.color}>{CALENDAR_PHASE_META.running.label}</Tag> : null}
        {attendance ? <Tag color={attendance.color}>{attendance.label}</Tag> : null}
      </HStack>
    </VStack>} />;
}
