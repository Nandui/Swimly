import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
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
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { WrongClub } from "@/components/clubs/wrong-club";
import { ArchiveCourse, EditCourse } from "@/components/courses/course-actions";
import {
  EndEnrolment,
  EnrolIntoCourse,
  PromoteFromWaitlist,
  TransferEnrolment,
} from "@/components/enrolment/enrolment-actions";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import {
  capacityLabel,
  capacityTone,
  courseLabel,
  courseName,
  formatSlot,
} from "@/lib/courses/constants";
import {
  getCourse,
  getInstructorOptions,
  getRoster,
  type RosterEntry,
} from "@/lib/courses/data/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { getTransferTargets, type TransferTarget } from "@/lib/enrolment/data/enrolments";
import { formatDate } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { ageLabel, fullName } from "@/lib/students/constants";
import { AppIcon } from "@/components/ui-kit/app-icon";

export const metadata: Metadata = { title: "Class" };

export default async function CoursePage(props: PageProps<"/courses/[id]">) {
  const session = await screenPage("courses");
  const manage = can(session, "enrolment.manage");
  const admin = can(session, "courses.manage");
  const { id } = await props.params;

  // The course is fetched alongside everything else rather than first: none of
  // the other reads need anything from it but the id, so waiting on it was one
  // whole round trip spent for nothing. The 404 check moves to after.
  const [course, roster, targets, levels, instructors, { club }] = await Promise.all([
    getCourse(id),
    getRoster(id),
    manage ? getTransferTargets(id) : Promise.resolve([]),
    admin ? getLevelOptions() : Promise.resolve([]),
    admin ? getInstructorOptions() : Promise.resolve([]),
    getCurrentClub(),
  ]);
  if (!course) notFound();
  if (course.clubId !== club.id) {
    return (
      <WrongClub
        what={`The class ${courseName(course)} (${formatSlot(course)})`}
        owner={course.club}
        current={club}
      />
    );
  }

  const active = roster.filter((entry) => entry.status === "ACTIVE");
  const waiting = roster.filter((entry) => entry.status === "WAITLISTED");
  const tone = capacityTone(active.length, course.capacity);

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <BackLink href="/courses" current={courseName(course)}>
          Classes
        </BackLink>
        <PageHeader
          title={
            <HStack gap={2} vAlign="center" wrap="wrap">
              {courseName(course)}
              {course.archivedAt ? <Tag color="gray">Archived</Tag> : null}
              {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
            </HStack>
          }
          description={
            `${formatSlot(course)} · ${course.level.programme.name} · ${course.level.name}` +
            (course.location ? ` · ${course.location}` : "") +
            (course.instructor ? ` · ${course.instructor.name}` : " · nobody assigned")
          }
          actions={
            <>
              {/* The same class page the deck opens: attendance, then
                  competencies. One road to the class, whichever screen you
                  came from. */}
              {!course.archivedAt && can(session, "attendance.mark") ? (
                <Button
                  label="Open class"
                  variant="secondary"
                  href={`/courses/${course.id}/class`}
                  icon={<AppIcon name="clipboardList" size="sm" />}
                />
              ) : null}
              {manage && !course.archivedAt ? (
                <EnrolIntoCourse course={course} taken={active.length} />
              ) : null}
              {admin ? (
                <>
                  <EditCourse
                    course={course}
                    levels={levels}
                    instructors={instructors}
                    variant="button"
                  />
                  <ArchiveCourse course={course} />
                </>
              ) : null}
            </>
          }
        />
      </VStack>

      <Lead>
        <Num>{capacityLabel(active.length, course.capacity)}</Num> places taken
        {waiting.length > 0 ? (
          <>
            , with <Alert>{waiting.length}</Alert> waiting
          </>
        ) : null}
        .
      </Lead>

      {roster.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nobody in this class yet"
          hint="Enrol a swimmer and they will appear on the roster and on every register from then on."
          action={
            manage && !course.archivedAt ? (
              <EnrolIntoCourse course={course} taken={0} />
            ) : null
          }
        />
      ) : (
        <VStack gap={6}>
          <VStack gap={3} as="section">
            <Heading level={2}>Roster</Heading>
            {active.length === 0 ? (
              <Text as="p" display="block" color="secondary">
                Nobody has a place yet — everyone below is waiting.
              </Text>
            ) : (
              <RosterTable
                entries={active}
                courseLevelId={course.levelId}
                classLabel={courseLabel(course)}
                manage={manage}
                targets={targets}
              />
            )}
          </VStack>

          {waiting.length > 0 ? (
            <VStack gap={3} as="section">
              <Heading level={2}>Waiting</Heading>
              <RosterTable
                entries={waiting}
                courseLevelId={course.levelId}
                classLabel={courseLabel(course)}
                manage={manage}
                targets={targets}
              />
            </VStack>
          ) : null}
        </VStack>
      )}
    </VStack>
  );
}

function RosterTable({
  entries,
  courseLevelId,
  classLabel,
  manage,
  targets,
}: {
  entries: RosterEntry[];
  courseLevelId: string;
  classLabel: string;
  manage: boolean;
  targets: TransferTarget[];
}) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Swimmer</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Age
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Since
          </TableHeaderCell>
          <TableHeaderCell scope="col">Status</TableHeaderCell>
          {manage ? (
            <TableHeaderCell scope="col">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const meta = ENROLMENT_STATUS_META[entry.status];
          const outOfSequence = entry.level.id !== courseLevelId;
          return (
            <TableRow key={entry.id}>
              <TableCell>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Link href={`/students/${entry.student.id}`} weight="medium">
                    {fullName(entry.student)}
                  </Link>
                  {entry.student.medicalNotes ? <Tag color="red">Medical</Tag> : null}
                  {outOfSequence ? <Tag color="purple">{entry.level.name}</Tag> : null}
                </HStack>
                {entry.placementReason ? (
                  <Text type="supporting" display="block">
                    Placed here: {entry.placementReason}
                  </Text>
                ) : null}
                <Text type="supporting" display="block" className="md:hidden">
                  {ageLabel(entry.student.dateOfBirth)} · since {formatDate(entry.startedOn)}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" hasTabularNumbers>
                  {ageLabel(entry.student.dateOfBirth)}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" textWrap="nowrap">
                  {formatDate(entry.startedOn)}
                </Text>
              </TableCell>
              <TableCell>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              {manage ? (
                <TableCell>
                  <HStack gap={1} vAlign="center" hAlign="end">
                    {entry.status === "WAITLISTED" ? (
                      <PromoteFromWaitlist enrolment={entry} />
                    ) : null}
                    <TransferEnrolment enrolment={entry} targets={targets} />
                    <EndEnrolment enrolment={entry} classLabel={classLabel} />
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
