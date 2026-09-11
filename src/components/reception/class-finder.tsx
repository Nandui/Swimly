"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Section } from "@astryxdesign/core/Section";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/ui-kit/tag";
import { capacityTone, courseLabelWithSite as courseLabel, courseName, DAY_META, DAYS_IN_ORDER, formatSlotShort, formatTime, placesLeft } from "@/lib/courses/constants";
import { enrolStudent, transferEnrolment } from "@/lib/enrolment/actions/enrolment";
import type { ReceptionClassOption, ReceptionSwimmer } from "@/lib/reception/data";
import { emptyClassFilters, findReceptionClasses, invalidTimeRange, type ClassFilters } from "@/lib/reception/finder";
import { fullName } from "@/lib/students/constants";

type Place = ReceptionSwimmer["enrolments"][number];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => ({ value: String(i * 30), label: formatTime(i * 30) }));

export function ClassFinder({ student, courses, source, workingSiteId = "any", sites, onClose }: {
  student: ReceptionSwimmer;
  courses: ReceptionClassOption[];
  source?: Place;
  workingSiteId?: string;
  sites: { id: string; name: string }[];
  onClose: () => void;
}) {
  const initialLevel = source?.level.id ?? (new Set(student.enrolments.map(place => place.level.id)).size === 1 ? student.enrolments[0].level.id : "any");
  const [filters, setFilters] = useState(() => emptyClassFilters(initialLevel, workingSiteId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(6);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => { heading.current?.focus(); }, []);

  const levels = [...new Map(courses.map(course => [course.level.id, course.level])).values()]
    .sort((a, b) => a.programme.sortOrder - b.programme.sortOrder || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const levelOptions = [{ value: "any", label: "All levels" }, ...levels.map(level => ({ value: level.id, label: `${level.name} · ${level.programme.name}` }))];
  // A pinned level can outlive its curriculum or have no other classes.
  for (const place of student.enrolments) {
    if (!levelOptions.some(option => option.value === place.level.id)) levelOptions.push({ value: place.level.id, label: `${place.level.name} · ${place.programme.name}` });
  }
  const matches = findReceptionClasses(courses, filters, student.enrolments.map(place => place.course.id));
  const selected = matches.find(course => course.id === selectedId);
  const waitlist = !!selected && placesLeft(selected._count.enrolments, selected.capacity) === 0;
  const invalidRange = invalidTimeRange(filters);

  function change<K extends keyof ClassFilters>(key: K, value: ClassFilters[K]) {
    setFilters(current => ({ ...current, [key]: value }));
    setSelectedId(null);
    setLimit(6);
  }

  return <Section variant="muted" padding={4} aria-labelledby={`${id}-heading`} data-reception-editing>
    <VStack gap={4}>
      <HStack gap={3} hAlign="between" vAlign="start">
        <VStack gap={1} className="min-w-0 flex-1">
          <Heading level={3} id={`${id}-heading`} ref={heading} tabIndex={-1}>{source ? `Move ${student.firstName} to another class` : `Find a place for ${student.firstName}`}</Heading>
          <Text color="secondary">Compare classes at either site across the week. {source ? "Their current place stays until you confirm the move." : "Their existing places stay unless you choose to move one."}</Text>
        </VStack>
        <Button label="Close" aria-label="Close finder" variant="ghost" onClick={onClose} className="shrink-0" />
      </HStack>

      <Grid gap={3} align="end" className="grid-cols-2 lg:grid-cols-4">
        <Selector label="Site" value={filters.site} options={[{ value: "any", label: "All sites" }, ...sites.map(site => ({ value: site.id, label: site.name }))]} onChange={value => change("site", value)} width="100%" />
        <VStack className="min-w-0">
          <Selector label="Level" value={filters.level} options={levelOptions} onChange={value => change("level", value)} hasSearch width="100%" />
        </VStack>
        <Selector label="Day" value={filters.day} options={[{ value: "any", label: "Any day" }, ...DAYS_IN_ORDER.map(day => ({ value: day, label: DAY_META[day].label }))]} onChange={value => change("day", value)} width="100%" />
        <Selector label="Starts from" value={filters.from} options={[{ value: "any", label: "Any time" }, ...TIME_OPTIONS]} onChange={value => change("from", value)} width="100%" />
        <Selector label="Starts by" value={filters.until} options={[{ value: "any", label: "Any time" }, ...TIME_OPTIONS]} onChange={value => change("until", value)} width="100%" />
        <CheckboxInput label="Available only" value={filters.availableOnly} onChange={value => change("availableOnly", value)} className="min-h-11" />
      </Grid>
      {invalidRange ? <Banner status="warning" title="Starts by must be the same as or later than Starts from." collapsible={false} /> : null}
      <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
        <Text color="secondary" role="status">{matches.length} {matches.length === 1 ? "matching class" : "matching classes"}{matches.length > limit ? ` · Showing ${limit}` : ""} · Places rechecked at confirmation</Text>
        <HStack gap={2} wrap="wrap">
          <Button label="Refresh places" variant="ghost" size="sm" isLoading={refreshing} onClick={() => { setSelectedId(null); startRefresh(() => router.refresh()); }} />
          <Button label="Reset filters" variant="ghost" size="sm" onClick={() => { setFilters(emptyClassFilters("any", workingSiteId)); setSelectedId(null); setLimit(6); }} />
        </HStack>
      </HStack>
      {matches.length ? <Table density="compact" textOverflow="wrap" className="table-fixed bg-surface" aria-label="Matching classes across the week">
        <TableHeader><TableRow>
          <TableHeaderCell className="hidden md:table-cell md:w-32 max-w-none">Day &amp; time</TableHeaderCell>
          <TableHeaderCell>Class</TableHeaderCell>
          <TableHeaderCell className="hidden lg:table-cell">Instructor</TableHeaderCell>
          <TableHeaderCell className="hidden md:table-cell">Places</TableHeaderCell>
          <TableHeaderCell className="w-24 max-w-none"><Text className="sr-only">Choose class</Text></TableHeaderCell>
        </TableRow></TableHeader>
        <TableBody>{matches.slice(0, limit).map(course => {
          const left = placesLeft(course._count.enrolments, course.capacity);
          const full = left === 0;
          const tone = capacityTone(course._count.enrolments, course.capacity);
          const chosen = course.id === selected?.id;
          const availability = full ? "Full" : left === null ? "No capacity limit" : `${left} ${left === 1 ? "place" : "places"} free`;
          return <TableRow key={course.id} className={chosen ? "bg-accent-muted" : undefined}>
            <TableCell className="hidden md:table-cell"><VStack gap={1}><Text weight="semibold">{DAY_META[course.dayOfWeek].short}</Text><Text hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text></VStack></TableCell>
            <TableCell><VStack gap={1} className="break-words">
              <Text weight="semibold">{courseName(course)}</Text>
              <Text hasTabularNumbers className="md:hidden">{formatSlotShort(course)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text>
              {course.name && course.name !== course.level.name ? <Text color="secondary">{course.level.name}</Text> : null}
              <Text color="secondary">{course.club.name} · {course.location ?? "Location not recorded"}</Text>
              {filters.level === "any" ? <Text color="secondary">{course.level.programme.name}</Text> : null}
              <Text color="secondary" className="lg:hidden">{course.instructor?.name ?? "Instructor not assigned"}</Text>
              <Text className="md:hidden">{availability}</Text>
            </VStack></TableCell>
            <TableCell className="hidden lg:table-cell">{course.instructor?.name ?? "Not assigned"}</TableCell>
            <TableCell className="hidden md:table-cell">{tone ? <Tag color={tone.color}>{tone.label}</Tag> : <Text>{availability}</Text>}</TableCell>
            <TableCell><Button label={chosen ? "Selected" : full && !source ? "Waitlist" : full ? "Full" : "Select"}
              variant={chosen ? "primary" : "secondary"} isDisabled={refreshing || (!!source && full)} aria-pressed={chosen}
              aria-label={`${chosen ? "Selected" : full && !source ? "Choose waitlist for" : "Select"} ${courseLabel(course)}`}
              onClick={() => setSelectedId(course.id)} /></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table> : <EmptyState isCompact title="No classes match these preferences" description={invalidRange ? "Adjust the start time range to continue." : "Try another day or time, or turn off Available only to see full classes. Existing class and waitlist places are excluded."} />}
      {matches.length > limit ? <HStack><Button label="Show more classes" onClick={() => setLimit(current => current + 6)} /></HStack> : null}
      {!filters.availableOnly ? <Text color="secondary">{source ? "Full classes cannot receive a move. Close the finder and use Find a place to join another waitlist while keeping the current place." : "Choose Waitlist to request a waitlist place. Your other places will stay."}</Text> : null}

      {selected && !(source && waitlist) ? <VStack gap={4}>
        <Grid gap={4} className="grid-cols-1 md:grid-cols-2" aria-label="Review selected place">
          <VStack gap={1}>
            <Text color="secondary">{source ? "Current place" : "Existing places"}</Text>
            {source ? <><Text weight="semibold">{formatSlotShort(source.course)} · {courseName(source.course)}</Text><Text color="secondary">{source.course.club.name} · {source.level.name} · {source.status === "WAITLISTED" ? "Waitlisted" : "Enrolled"}</Text></> : <Text>{student.enrolments.length ? "Kept unless you choose a move during review" : "No current places"}</Text>}
          </VStack>
          <VStack gap={1}><Text color="secondary">{waitlist ? "New waitlist place" : "New place"}</Text><Text weight="semibold">{formatSlotShort(selected)} · {courseName(selected)}</Text><Text color="secondary">{selected.club.name} · {selected.level.name} · {selected.location ?? "Location not recorded"}</Text></VStack>
        </Grid>
        <HStack hAlign="end">
          <FormDialog key={`${source?.id ?? "enrol"}-${selected.id}-${waitlist}`} width="sm:max-w-xl"
            trigger={<Button label={source ? "Review move" : waitlist ? "Review waitlist" : "Review enrolment"} variant="primary" />}
            title={source ? `Move ${fullName(student)}` : `${waitlist ? "Waitlist" : "Enrol"} ${fullName(student)}`}
            description={source ? `From ${courseLabel(source.course)} to ${courseLabel(selected)}. The current ${source.status === "WAITLISTED" ? "waitlist " : ""}place closes when the new place opens. Attendance stays on record.${source.scheduledEndOn ? " The scheduled unenrolment is cancelled; the new place has no end date." : ""}` : `${courseLabel(selected)}. ${waitlist ? "Join the waitlist if the class is still full; if a place has opened, enrol directly." : "Enrol only if a place is still available."}`}
            submitLabel={source ? "Continue" : waitlist ? "Confirm waitlist request" : "Enrol"}
            successMessage={source ? "Swimmer moved" : "Place saved — check current places for its status"}
            onSuccess={onClose}
            submit={(data, confirmation) => source
              ? transferEnrolment(source.id, selected.id, String(data.get("placementReason") ?? ""), confirmation)
              : enrolStudent({ studentId: student.id, courseId: selected.id, placementReason: String(data.get("placementReason") ?? ""), allowWaitlist: waitlist }, confirmation)}>
            <Text as="p">{selected.level.name} · {selected.level.programme.name} · {selected.location ?? "Location not recorded"}</Text>
            <Field label="Why this level, if they haven’t earned it" htmlFor={`${id}-reason`} hint="Only needed for a placement beyond their earned level. Record what supports it for the instructor.">
              <Textarea id={`${id}-reason`} name="placementReason" rows={2} maxLength={2000} />
            </Field>
          </FormDialog>
        </HStack>
      </VStack> : <Text color="secondary">Choose a class to review {source ? "the move" : "the new place"}.</Text>}
    </VStack>
  </Section>;
}
