"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Plus, Users } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EndEnrolment, EnrolInCourseForStudent, PromoteFromWaitlist, TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { AddStudent } from "@/components/students/student-actions";
import { StudentSearch } from "@/components/students/student-search";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { capacityTone, courseLabel, courseName, formatSlotShort, formatTime } from "@/lib/courses/constants";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { formatDate } from "@/lib/format";
import type { ReceptionSwimmer } from "@/lib/reception/data";
import { groupReceptionClasses, partitionReceptionClasses, receptionAvailability, receptionHref, RECEPTION_TIME_META, type ReceptionClass, type ReceptionGrouping } from "@/lib/reception/timetable";
import { ageLabel, fullName, STUDENT_STATUS_META } from "@/lib/students/constants";

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

/** Swimmer lookup, details and enrolment lead in DOM and visual order.
 *  At xl the workspace takes two grid tracks and today's classes one; below
 *  xl the timetable follows the complete swimmer workspace. The shell owns
 *  the page frame and scrolling. Selection and grouping stay in the URL. */
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
  const selectSwimmer = (id?: string | null) => startSelection(() => router.push(receptionHref(id, group), { scroll: false }));

  return (
    <VStack gap={6}>
      <PageHeader title="Reception" description={dateLabel}
        actions={access.addSwimmers ? <AddStudent onCreated={selectSwimmer} trigger={
          <Button label="Add swimmer" variant={student ? "secondary" : "primary"} icon={<Icon icon={Plus} size="sm" />} />
        } /> : undefined} />

      <Grid gap={8} align="start" className="grid-cols-1 xl:grid-cols-3">
        <VStack as="section" aria-labelledby="reception-lookup" gap={6} className="min-w-0 xl:col-span-2">
          <VStack gap={3}>
            <Heading level={2} id="reception-lookup">Find a swimmer</Heading>
            <StudentSearch key={student?.id ?? "search"} label="Find a swimmer" labelHidden hasSearchIcon
              placeholder="Swimmer name or member number" selected={student} includeInactive
              onSelect={hit => selectSwimmer(hit?.id)}
              emptyText="No swimmers match in this club. Try their member number." />
          </VStack>
          {selecting ? <Text as="p" role="status">Loading swimmer…</Text> : unavailable ? (
            <Banner status="warning" title="Swimmer unavailable in this club. Search again or check the selected club." collapsible={false} />
          ) : student ? (
            <SwimmerWorkspace student={student} targets={targets} courses={courses} access={access} onClear={() => selectSwimmer(null)} />
          ) : (
            <Section variant="muted" padding={6}>
              <EmptyState title="Find a swimmer to get started" headingLevel={2}
                description={`Search above to see their contact details, current places and enrolment options.${access.addSwimmers ? " For a new swimmer, choose Add swimmer." : ""}`}
              />
            </Section>
          )}
          <QuickBooking access={access} />
        </VStack>

        <VStack as="aside" aria-labelledby="reception-timetable" gap={5} className="min-w-0">
          <VStack gap={3}>
            <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
              <Heading level={2} id="reception-timetable">Today’s classes</Heading>
              <Button label="Refresh" variant="ghost" size="sm" isLoading={refreshing} onClick={() => startRefresh(() => router.refresh())} />
            </HStack>
            <Text color="secondary">{courses.length} {courses.length === 1 ? "class" : "classes"} · {running.length} running now · As of {formatTime(now)}</Text>
            <LinkSegments label="Group today's classes" value={group} options={[
              { value: "time", label: "By time", href: receptionHref(student?.id, "time") },
              { value: "level", label: "By level", href: receptionHref(student?.id, "level") },
            ]} />
          </VStack>
          {courses.length === 0 ? (
            <EmptyState isCompact title="No classes timetabled today"
              description={`Nothing is timetabled at ${clubName} today. You can still manage swimmers and their places.`}
              actions={access.courses ? <Button href="/courses?day=any" label="Find a class on another day" /> : undefined} />
          ) : <ReceptionTimetable courses={courses} group={group} now={now} canOpen={access.courses} />}
        </VStack>
      </Grid>
    </VStack>
  );
}

function QuickBooking({ access }: Pick<ReceptionDashboardProps, "access">) {
  const links = [
    { visible: access.together, href: "/together", label: "Find sibling times", icon: Users },
    { visible: access.assessments, href: "/assessments", label: "Book an assessment", icon: CalendarCheck },
    { visible: access.courses, href: "/courses?day=any", label: "Find a class", icon: CalendarDays },
  ].filter(link => link.visible);
  if (!links.length) return null;
  return <VStack gap={3} as="section" aria-labelledby="reception-booking">
    <Heading level={2} id="reception-booking">Quick booking</Heading>
    <HStack gap={2} wrap="wrap">
      {links.map(link => <Button key={link.href} href={link.href} label={link.label}
        icon={<Icon icon={link.icon} size="sm" />} />)}
    </HStack>
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

function SwimmerWorkspace({ student, targets, courses, access, onClear }: {
  student: ReceptionSwimmer;
  targets: TransferTarget[];
  courses: ReceptionClass[];
  access: ReceptionDashboardProps["access"];
  onClear: () => void;
}) {
  const mayEnrol = access.manage && student.status === "ACTIVE";
  return <VStack gap={5} as="section" aria-label={`Details and enrolment for ${fullName(student)}`}>
    <Divider />
    <VStack gap={3}>
      <HStack gap={3} hAlign="between" vAlign="start">
        <VStack gap={2} className="min-w-0">
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Heading level={2}>{fullName(student)}</Heading>
            <Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag>
          </HStack>
          <Text color="secondary">{student.memberNumber ?? "No member number recorded"} · {student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Date of birth not recorded"}</Text>
        </VStack>
        <IconButton label={`Clear ${fullName(student)}`} variant="ghost" icon={<Icon icon="close" size="sm" />} onClick={onClear} />
      </HStack>
      <HStack gap={2} wrap="wrap" vAlign="center">
        {mayEnrol ? <EnrolInCourseForStudent student={student} courses={targets} variant="primary" /> : null}
        {access.students ? <Button href={`/students/${student.id}`} label="Full swimmer profile" variant="secondary" /> : null}
      </HStack>
    </VStack>
    {student.status === "INACTIVE" ? <Banner status="info" title="This swimmer is inactive. They must be made active before enrolling or moving them." collapsible={false} /> : null}

    <Section variant="muted" padding={4} aria-label="Contact details">
      <VStack gap={2}>
        <Heading level={3}>Contact details</Heading>
        <Text>{student.contactName || "No contact name recorded"}</Text>
        <HStack gap={4} wrap="wrap" vAlign="center">
          {student.contactPhone ? <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`} className="min-h-11 inline-flex items-center break-all">{student.contactPhone}</Link> : <Text color="secondary">No phone number recorded</Text>}
          {student.contactEmail ? <Link href={`mailto:${student.contactEmail}`} className="min-h-11 inline-flex items-center break-all">{student.contactEmail}</Link> : null}
        </HStack>
      </VStack>
    </Section>

    <VStack gap={3} as="section" aria-labelledby="reception-enrolments">
      <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
        <Heading level={3} id="reception-enrolments">Enrolments</Heading>
        <Text color="secondary">{student.enrolments.length} current {student.enrolments.length === 1 ? "place" : "places"}</Text>
      </HStack>
      {student.enrolments.length === 0 ? <Text as="p" color="secondary">No current class or waitlist place.{mayEnrol ? " Choose Enrol in a class to find a place." : ""}</Text> : (
        <List hasDividers aria-labelledby="reception-enrolments">
          {student.enrolments.map(enrolment => {
            const label = courseLabel(enrolment.course);
            const status = ENROLMENT_STATUS_META[enrolment.status];
            const coverName = courses.find(course => course.id === enrolment.course.id)?.coverName;
            return <ListItem key={enrolment.id} label={
              <HStack gap={2} wrap="wrap" vAlign="center"><Text weight="semibold">{courseName(enrolment.course)}</Text><Tag color={status.color}>{status.label}</Tag></HStack>
            } description={
              <VStack gap={2} className="min-w-0 break-words">
                <Text hasTabularNumbers>{formatSlotShort(enrolment.course)}–{formatTime(enrolment.course.startMinutes + enrolment.course.durationMinutes)}</Text>
                <Text color="secondary">{enrolment.level.name} · {enrolment.course.location ?? "Location not recorded"} · {coverName ? `${coverName} (cover today)` : enrolment.course.instructor?.name ?? "Instructor not assigned"}</Text>
                {enrolment.course.archivedAt ? <Text color="secondary">This class is archived.</Text> : null}
                {enrolment.scheduledEndOn ? <Text color="secondary">Unenrols {formatDate(enrolment.scheduledEndOn)}</Text> : null}
                <HStack gap={2} wrap="wrap" vAlign="center">
                  {mayEnrol && enrolment.status === "WAITLISTED" && !enrolment.course.archivedAt ? <PromoteFromWaitlist variant="button" classLabel={label} enrolment={{ ...enrolment, student }} /> : null}
                  {mayEnrol ? <TransferEnrolment variant="button" classLabel={label} enrolment={{ ...enrolment, student }} targets={targets.filter(target => target.id !== enrolment.course.id)} /> : null}
                  {access.manage ? <EndEnrolment variant="button" enrolment={{ ...enrolment, student }} classLabel={label} /> : null}
                  {access.courses ? <Button href={`/courses/${enrolment.course.id}`} label="Class details" aria-label={`Class details for ${label}`} variant="ghost" /> : null}
                </HStack>
              </VStack>
            } />;
          })}
        </List>
      )}
      {!access.manage ? <Text as="p" color="secondary">You can look up classes here. Moving or unenrolling a swimmer needs the enrolment permission.</Text> : null}
    </VStack>
  </VStack>;
}
