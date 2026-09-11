import type { ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ArchiveCourse, EditCourse } from "./course-actions";
import { EndEnrolment, EnrolIntoCourse, PromoteFromWaitlist, TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { capacityLabel, capacityTone, courseLabel, courseName, formatSlot, placesLeft } from "@/lib/courses/constants";
import type { CourseDetail, InstructorOption, RosterEntry } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { PLACEMENT_META } from "@/lib/enrolment/constants";
import { formatDate } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { MEDICAL_STATUS_META, STUDENT_STATUS_META, ageLabel, fullName } from "@/lib/students/constants";

type ClassAccess = { manage: boolean; admin: boolean; attendance: boolean; students: boolean };

/** Inspection is a full page: the roster leads, and the same permission-gated
 * enrolment actions used elsewhere remain the only write paths. */
export function ClassDetailView({ course, roster, targets, levels, instructors, access, backHref, levelImage, coverName }: {
  course: CourseDetail;
  roster: RosterEntry[];
  targets: TransferTarget[];
  levels: LevelOption[];
  instructors: InstructorOption[];
  access: ClassAccess;
  backHref: string;
  levelImage?: ReactNode;
  coverName?: string;
}) {
  const active = roster.filter(entry => entry.status === "ACTIVE");
  const waiting = roster.filter(entry => entry.status === "WAITLISTED");
  const tone = capacityTone(active.length, course.capacity);
  const available = placesLeft(active.length, course.capacity);
  return <VStack gap={6}>
    <VStack gap={3} className="[&_a]:min-h-11">
      <BackLink href={backHref} current={courseName(course)}>Classes</BackLink>
      <PageHeader title={<HStack gap={2} vAlign="center" wrap="wrap">{levelImage}{courseName(course)}</HStack>}
        description={`${course.level.programme.name} · ${course.level.name}`}
        actions={access.manage && !course.archivedAt ? <EnrolIntoCourse course={course} taken={active.length} /> : undefined} />
      {course.archivedAt || tone ? <HStack gap={2} wrap="wrap">
        {course.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
        {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
      </HStack> : null}
    </VStack>

    <Section padding={0} paddingBlock={4} dividers={["top", "bottom"]} aria-label="Class details">
      <Grid gap={4} className="grid-cols-2 xl:grid-cols-4">
        <ClassFact label="Weekly schedule" value={formatSlot(course)} hint={`${course.durationMinutes} minutes`} />
        <ClassFact label="Pool area" value={course.location ?? "Not recorded"} />
        <ClassFact label="Instructor" value={course.instructor?.name ?? "Not assigned"}
          hint={coverName ? `${coverName} is covering today` : undefined} />
        <ClassFact label="Places" value={`${capacityLabel(active.length, course.capacity)}${course.capacity === null ? "" : " enrolled"}`}
          hint={course.archivedAt ? "Archived · closed to new enrolments" : available === null ? "No capacity limit" : `${available} available · ${waiting.length} waiting`} />
      </Grid>
    </Section>

    <VStack as="section" gap={3} aria-labelledby="enrolled-heading">
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={2} id="enrolled-heading">Enrolled swimmers ({active.length})</Heading>
        {access.attendance && !course.archivedAt ? <Button label="Attendance & progress" variant="secondary"
          href={`/courses/${course.id}/class`} icon={<AppIcon name="clipboardList" size="sm" />} /> : null}
      </HStack>
      {active.length ? <ClassRoster entries={active} course={course} access={access} targets={targets} /> :
        <EmptyState compact icon="users" title="No enrolled swimmers"
          hint={course.archivedAt ? "There are no current enrolments in this archived class." : waiting.length ? "Swimmers on the waitlist appear below. A place must be available before they can enrol." : access.manage ? "Choose Enrol a swimmer to add the first place in this class." : "Swimmers will appear here when they are enrolled."} />}
    </VStack>

    <VStack as="section" gap={3} aria-labelledby="waitlist-heading">
      <Heading level={2} id="waitlist-heading">Waitlist ({waiting.length})</Heading>
      {waiting.length ? <>
        <Text color="secondary">Waiting swimmers do not hold a place. Enrolling from the waitlist checks capacity again.</Text>
        <ClassRoster entries={waiting} course={course} access={access} targets={targets} waiting />
      </> : <Text color="secondary">No swimmers are waiting for this class.</Text>}
    </VStack>

    {access.admin ? <Section padding={0} paddingBlockStart={4} dividers={["top"]}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={1}><Heading level={2}>Manage class</Heading><Text color="secondary">Update the weekly schedule, instructor or capacity.</Text></VStack>
        <HStack gap={2} wrap="wrap"><EditCourse course={course} levels={levels} instructors={instructors} variant="button" /><ArchiveCourse course={course} /></HStack>
      </HStack>
    </Section> : null}
  </VStack>;
}

function ClassFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <VStack gap={1}><Text color="secondary">{label}</Text><Text weight="medium">{value}</Text>{hint ? <Text color="secondary">{hint}</Text> : null}</VStack>;
}

function ClassRoster({ entries, course, access, targets, waiting = false }: {
  entries: RosterEntry[];
  course: CourseDetail;
  access: ClassAccess;
  targets: TransferTarget[];
  waiting?: boolean;
}) {
  const label = courseLabel(course);
  return <Table hasHover textOverflow="wrap" className="table-fixed" aria-label={waiting ? "Waitlisted swimmers" : "Enrolled swimmers"}>
    <TableHeader><TableRow isHeaderRow>
      <TableHeaderCell scope="col">Swimmer</TableHeaderCell>
      <TableHeaderCell scope="col" className="hidden md:table-cell">Placement</TableHeaderCell>
      <TableHeaderCell scope="col" className="hidden lg:table-cell w-32 max-w-none">{waiting ? "Waiting since" : "Enrolled since"}</TableHeaderCell>
      {access.manage ? <TableHeaderCell scope="col" className="hidden md:table-cell w-48 max-w-none"><Text className="sr-only">Enrolment actions</Text></TableHeaderCell> : null}
    </TableRow></TableHeader>
    <TableBody>{entries.map(entry => {
      const student = entry.student;
      const placementDiffers = entry.level.id !== course.levelId;
      const inactive = student.status !== "ACTIVE";
      return <TableRow key={entry.id}>
        <TableCell><VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {access.students ? <Link href={`/students/${student.id}`} weight="semibold" className="inline-flex min-h-11 items-center">{fullName(student)}</Link> : <Text weight="semibold">{fullName(student)}</Text>}
            {student.medicalNotes ? <Tag color={MEDICAL_STATUS_META.notes.color}>{MEDICAL_STATUS_META.notes.label}</Tag> : null}
            {inactive ? <Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag> : null}
          </HStack>
          <Text color="secondary">{student.memberNumber ?? "No member number"} · {student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Age not recorded"}</Text>
          <VStack gap={1} className="md:hidden"><Placement entry={entry} differs={placementDiffers} /></VStack>
          <Text color="secondary" className="lg:hidden">{waiting ? "Waiting since" : "Enrolled since"} {formatDate(entry.startedOn)}</Text>
          {entry.scheduledEndOn ? <Text color="secondary">Unenrols {formatDate(entry.scheduledEndOn)}</Text> : null}
          {access.manage ? <HStack gap={2} wrap="wrap" className="md:hidden"><RosterActions entry={entry} classLabel={label} targets={targets} canPromote={waiting && !course.archivedAt} /></HStack> : null}
        </VStack></TableCell>
        <TableCell className="hidden md:table-cell"><VStack gap={1}><Placement entry={entry} differs={placementDiffers} /></VStack></TableCell>
        <TableCell className="hidden lg:table-cell"><Text color="secondary">{formatDate(entry.startedOn)}</Text></TableCell>
        {access.manage ? <TableCell className="hidden md:table-cell"><HStack gap={2} wrap="wrap" hAlign="end"><RosterActions entry={entry} classLabel={label} targets={targets} canPromote={waiting && !course.archivedAt} /></HStack></TableCell> : null}
      </TableRow>;
    })}</TableBody>
  </Table>;
}

function RosterActions({ entry, classLabel, targets, canPromote }: { entry: RosterEntry; classLabel: string; targets: TransferTarget[]; canPromote: boolean }) {
  const active = entry.student.status === "ACTIVE";
  return <>
    {canPromote && active ? <PromoteFromWaitlist enrolment={entry} variant="button" classLabel={classLabel} /> : null}
    {active ? <TransferEnrolment enrolment={entry} targets={targets} classLabel={classLabel} /> : null}
    <EndEnrolment enrolment={entry} classLabel={classLabel} />
  </>;
}

function Placement({ entry, differs }: { entry: RosterEntry; differs: boolean }) {
  return <>
    <HStack>{differs ? <Tag color={PLACEMENT_META.otherLevel.color}>{entry.level.name}</Tag> : <Text>{entry.level.name}</Text>}</HStack>
    <Text color="secondary">{entry.programme.name}</Text>
    {entry.placementReason ? <Text color="secondary">Placement: {entry.placementReason}</Text> : null}
  </>;
}
