"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Users } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EndEnrolment, EnrolInCourseForStudent, PromoteFromWaitlist, TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { AddStudent } from "@/components/students/student-actions";
import { StudentSearch } from "@/components/students/student-search";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { capacityLabel, capacityTone, courseLabel, courseName, formatSlotShort, formatTime, placesLeft } from "@/lib/courses/constants";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type { ReceptionSwimmer } from "@/lib/reception/data";
import { groupReceptionClasses, partitionReceptionClasses, receptionHref, RECEPTION_TIME_META, type ReceptionClass, type ReceptionGrouping } from "@/lib/reception/timetable";
import { ageLabel, fullName, STUDENT_STATUS_META } from "@/lib/students/constants";

import { formatDate } from "@/lib/format";

export type ReceptionDashboardProps = {
  clubName: string;
  dateLabel: string;
  now: number;
  courses: ReceptionClass[];
  student: ReceptionSwimmer | null;
  targets: TransferTarget[];
  group: ReceptionGrouping;
  unavailable: boolean;
  access: { manage: boolean; addSwimmers: boolean; students: boolean; courses: boolean; together: boolean; assessments: boolean };
};

/** Classes lead; the desk keeps the selected swimmer beside them. Selection
 *  and grouping live in the URL, including the swimmer just added at the desk. */
export function ReceptionDashboard(props: ReceptionDashboardProps) {
  const { clubName, dateLabel, now, courses, student, targets, group, unavailable, access } = props;
  const router = useRouter();
  const [selecting, startSelection] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  // Keep the server's date, time and places current without interrupting a form.
  useEffect(() => {
    function refreshIfIdle() {
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]") || document.activeElement?.matches("input,textarea,[role=combobox]")) return;
      startRefresh(() => router.refresh());
    }
    const timer = window.setInterval(refreshIfIdle, 60_000);
    window.addEventListener("focus", refreshIfIdle);
    document.addEventListener("visibilitychange", refreshIfIdle);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfIdle);
      document.removeEventListener("visibilitychange", refreshIfIdle);
    };
  }, [router]);
  const { running } = partitionReceptionClasses(courses, now);
  const hasDeskTools = Boolean(student) || access.courses || access.together || access.assessments;
  const selectSwimmer = (id?: string | null) => startSelection(() => router.push(receptionHref(id, group), { scroll: false }));

  return (
    <VStack gap={6}>
      <PageHeader title="Reception" description={dateLabel}
        actions={access.addSwimmers ? <AddStudent onCreated={selectSwimmer} /> : undefined} />

      <VStack gap={2}>
        <StudentSearch key={student?.id ?? "search"} label="Find a swimmer" labelHidden
          placeholder="Find swimmer by name or member number" selected={student} includeInactive
          onSelect={hit => selectSwimmer(hit?.id)}
          emptyText="No swimmers match in this club. Try their member number." />
        {selecting ? <Text as="p" role="status">Loading swimmer…</Text> : null}
        {unavailable && !selecting ? <Banner status="warning" title="Swimmer unavailable in this club. Search again or check the selected club." collapsible={false} /> : null}
      </VStack>

      <div className={`grid min-w-0 grid-cols-1 items-start gap-8 ${hasDeskTools ? "min-[1100px]:grid-cols-[minmax(0,1fr)_288px]" : ""}`}>
        <section aria-labelledby="reception-timetable" className="order-2 min-w-0 min-[1100px]:order-1">
          <VStack gap={6}>
            <VStack gap={3}>
              <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                <Heading level={2} id="reception-timetable">Today’s classes</Heading>
                <LinkSegments label="Group today's classes" value={group} options={[
                  { value: "time", label: "By time", href: receptionHref(student?.id, "time") },
                  { value: "level", label: "By level", href: receptionHref(student?.id, "level") },
                ]} />
              </HStack>
              <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
                <Text color="secondary">{courses.length} {courses.length === 1 ? "class" : "classes"} today · {running.length} running now · As of {formatTime(now)}</Text>
                <Button label="Refresh" variant="ghost" size="sm" isLoading={refreshing} onClick={() => startRefresh(() => router.refresh())} />
              </HStack>
            </VStack>

            {courses.length === 0 ? (
              <VStack gap={3} paddingBlock={5}>
                <Heading level={3}>No classes timetabled today</Heading>
                <Text as="p" color="secondary">Nothing is timetabled at {clubName} today. You can still find swimmers and plan a booking.</Text>
                {access.courses ? <div><Button href="/courses?day=any" label="Find a class on another day" /></div> : null}
              </VStack>
            ) : <ReceptionTimetable courses={courses} group={group} now={now} canOpen={access.courses} />}
          </VStack>
        </section>

        {hasDeskTools ? <aside aria-label="Desk tools" className="order-1 min-w-0 min-[1100px]:order-2">
          <VStack gap={6}>
            <QuickBooking access={access} />
            {student && !selecting ? <SwimmerPlaces student={student} targets={targets} courses={courses} access={access} onClear={() => selectSwimmer(null)} /> : null}
          </VStack>
        </aside> : null}
      </div>
    </VStack>
  );
}

function QuickBooking({ access }: Pick<ReceptionDashboardProps, "access">) {
  const links = [
    { visible: access.together, href: "/together", label: "Find sibling times", short: "Sibling times", icon: Users },
    { visible: access.assessments, href: "/assessments", label: "Book an assessment", short: "Assessments", icon: CalendarCheck },
    { visible: access.courses, href: "/courses?day=any", label: "Find a class", short: "Find a class", icon: CalendarDays },
  ].filter(link => link.visible);
  if (!links.length) return null;
  return <VStack gap={4} as="section" aria-labelledby="reception-booking">
    <Heading level={2} id="reception-booking">Quick booking</Heading>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2 sm:hidden">
      {links.map(link => <Button key={link.href} href={link.href} label={link.short} aria-label={link.label} width="100%" />)}
    </div>
    <div className="hidden grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2 sm:grid min-[1100px]:grid-cols-1">
      {links.map(link => <Button key={link.href} href={link.href} label={link.label} width="100%"
        icon={<Icon icon={link.icon} size="sm" />} endContent={<Icon icon="chevronRight" size="sm" />} />)}
    </div>
    <Text as="p" color="secondary" className="hidden min-[1100px]:block">For another day or a new place.</Text>
  </VStack>;
}

function ReceptionTimetable({ courses, group, now, canOpen }: Pick<ReceptionDashboardProps, "courses" | "group" | "now"> & { canOpen: boolean }) {
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
  return <Table hasHover textOverflow="wrap" aria-label="Classes in this group">
    <TableHeader className="sr-only"><TableRow isHeaderRow>
      <TableHeaderCell scope="col">Class and location</TableHeaderCell>
      <TableHeaderCell scope="col" className="max-md:hidden">Instructor</TableHeaderCell>
      <TableHeaderCell scope="col" className="max-sm:hidden">Places</TableHeaderCell>
      {canOpen ? <TableHeaderCell scope="col">Actions</TableHeaderCell> : null}
    </TableRow></TableHeader>
    <TableBody>{courses.map(course => {
      const left = placesLeft(course._count.enrolments, course.capacity);
      const tone = capacityTone(course._count.enrolments, course.capacity);
      const places = capacityLabel(course._count.enrolments, course.capacity);
      const teacher = course.coverName ?? course.instructor?.name ?? "Instructor not assigned";
      return <TableRow key={course.id}>
        <TableCell>
          <VStack gap={1}>
            <Text weight="semibold">{courseName(course)}</Text>
            {course.name && course.name !== course.level.name ? <Text color="secondary">{course.level.name}</Text> : null}
            {showTime ? <Text color="secondary" hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</Text> : null}
            <Text color="secondary">{course.location ?? "Location not recorded"}</Text>
            <Text color="secondary" className="md:hidden">{teacher}{course.coverName ? " (cover)" : ""}</Text>
            <HStack gap={2} wrap="wrap" vAlign="center" className="sm:hidden"><Text color="secondary" hasTabularNumbers>{places}</Text>{tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}</HStack>
          </VStack>
        </TableCell>
        <TableCell className="max-md:hidden"><VStack gap={1}>
          <Text>{teacher}</Text>
          {course.coverName ? <div><Tag color={ATTENDANCE_RECORD_META.covered.color}>{ATTENDANCE_RECORD_META.covered.label}</Tag></div> : null}
        </VStack></TableCell>
        <TableCell className="max-sm:hidden"><VStack gap={1}>
          <Text hasTabularNumbers>{places}</Text>
          {tone ? <div><Tag color={tone.color}>{tone.label}</Tag></div> : left !== null ? <Text color="secondary">{left} available</Text> : null}
        </VStack></TableCell>
        {canOpen ? <TableCell><HStack hAlign="end"><Button label="Open class" href={`/courses/${course.id}`}
          aria-label={`Open ${courseLabel(course)}`} endContent={<Icon icon="chevronRight" size="sm" />} /></HStack></TableCell> : null}
      </TableRow>;
    })}</TableBody>
  </Table>;
}

function SwimmerPlaces({ student, targets, courses, access, onClear }: {
  student: ReceptionSwimmer;
  targets: TransferTarget[];
  courses: ReceptionClass[];
  access: ReceptionDashboardProps["access"];
  onClear: () => void;
}) {
  const mayEnrol = access.manage && student.status === "ACTIVE";
  return <Card padding={5}>
    <VStack gap={4}>
      <HStack gap={2} hAlign="between" vAlign="start">
        <VStack gap={1} className="min-w-0"><Text color="secondary">Selected swimmer</Text><Heading level={2}>{fullName(student)}</Heading><Text color="secondary">{student.memberNumber ?? "No member number recorded"}</Text><Text color="secondary">{student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Date of birth not recorded"}</Text></VStack>
        <IconButton label={`Clear ${fullName(student)}`} variant="ghost" icon={<Icon icon="close" size="sm" />} onClick={onClear} />
      </HStack>
      {student.status !== "ACTIVE" ? <div><Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag></div> : null}
      {student.status === "INACTIVE" ? <Banner status="info" title="This swimmer is inactive. They must be made active before enrolling or moving them." collapsible={false} /> : null}
      <VStack gap={1} as="section" aria-label="Contact details">
        <Text weight="semibold">Contact</Text>
        <Text>{student.contactName || "No contact name recorded"}</Text>
        {student.contactPhone ? <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`} className="min-h-11 inline-flex items-center break-all">{student.contactPhone}</Link> : <Text color="secondary">No phone number recorded</Text>}
        {student.contactEmail ? <Link href={`mailto:${student.contactEmail}`} className="min-h-11 inline-flex items-center break-all">{student.contactEmail}</Link> : null}
      </VStack>
      <Divider />
      {student.enrolments.length === 0 ? <Text as="p" color="secondary">No current class or waitlist place.</Text> : student.enrolments.map((enrolment, index) => {
        const label = courseLabel(enrolment.course);
        const status = ENROLMENT_STATUS_META[enrolment.status];
        const coverName = courses.find(course => course.id === enrolment.course.id)?.coverName;
        return <VStack key={enrolment.id} gap={2} as="section" aria-label={`${label}, ${status.label}`}>
          {index > 0 ? <Divider /> : null}
          <HStack gap={2} wrap="wrap" vAlign="center"><Heading level={3}>{courseName(enrolment.course)}</Heading><Tag color={status.color}>{status.label}</Tag></HStack>
          <Text hasTabularNumbers>{formatSlotShort(enrolment.course)}–{formatTime(enrolment.course.startMinutes + enrolment.course.durationMinutes)}</Text>
          <Text as="p" color="secondary">{enrolment.level.name} · {enrolment.course.location ?? "Location not recorded"}</Text>
          <Text as="p" color="secondary">{coverName ? `${coverName} (cover today)` : enrolment.course.instructor?.name ?? "Instructor not assigned"}</Text>
          {enrolment.course.archivedAt ? <Text as="p" color="secondary">This class is archived.</Text> : null}
          {enrolment.scheduledEndOn ? <Text as="p" color="secondary">Unenrols {formatDate(enrolment.scheduledEndOn)}</Text> : null}
          <HStack gap={2} wrap="wrap" vAlign="center">
            {mayEnrol && enrolment.status === "WAITLISTED" && !enrolment.course.archivedAt ? <PromoteFromWaitlist variant="button" classLabel={label} enrolment={{ ...enrolment, student }} /> : null}
            {mayEnrol ? <TransferEnrolment variant="button" classLabel={label} enrolment={{ ...enrolment, student }} targets={targets.filter(target => target.id !== enrolment.course.id)} /> : null}
            {access.manage ? <EndEnrolment variant="button" enrolment={{ ...enrolment, student }} classLabel={label} /> : null}
            {access.courses ? <Link className="inline-flex min-h-11 items-center" href={`/courses/${enrolment.course.id}`} isStandalone>Class details</Link> : null}
          </HStack>
        </VStack>;
      })}
      <VStack gap={2}>
        {mayEnrol ? <EnrolInCourseForStudent student={student} courses={targets} /> : null}
        {access.students ? <Link className="inline-flex min-h-11 items-center" href={`/students/${student.id}`} isStandalone>Full swimmer profile</Link> : null}
      </VStack>
      {!access.manage ? <Text as="p" color="secondary">You can look up classes here. Moving or unenrolling a swimmer needs the enrolment permission.</Text> : null}
    </VStack>
  </Card>;
}
