import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Grid } from "@astryxdesign/core/Grid";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { EnrolInCourseForStudent } from "@/components/enrolment/enrolment-actions";
import { ProgressSection } from "@/components/progression/progress-section";
import {
  AssessmentList,
  AttendanceTable,
  Blank,
  EnrolmentTable,
  Panel,
  Row,
} from "@/components/students/profile-sections";
import { ProfileTabs, profileTab } from "@/components/students/profile-tabs";
import { EditStudent, ToggleStudentStatus } from "@/components/students/student-actions";
import { getStudentAssessments } from "@/lib/assessments/data/assessments";
import { getAttendanceForStudent } from "@/lib/attendance/data/register";
import { can } from "@/lib/authz";
import { courseLabelWithSite as courseLabel, formatSlotShort } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { getEnrolmentsForStudent } from "@/lib/enrolment/data/enrolments";
import { ageInYears, formatDate } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { getStudentProgress } from "@/lib/progression/data/progress";
import { STUDENT_STATUS_META, fullName } from "@/lib/students/constants";
import { getStudent } from "@/lib/students/data/students";
import { AppIcon } from "@/components/ui-kit/app-icon";

export const metadata: Metadata = { title: "Swimmer" };

/** A swimmer's profile.
 *
 *  Three layers, not one scroll. The header carries what the desk asks first:
 *  who, how old, which class. Under it, the things that must never be far
 *  away — medical notes, then personal details and contacts side by side.
 *  Everything that grows week on week — classes, progress, attendance,
 *  assessments — sits behind a tab, one section on screen at a time. */
export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const session = await screenPage("students");
  // One flag per permission, because this page hangs three different powers
  // off what used to be one tier: editing the swimmer, moving them between
  // classes, and signing a level off.
  const editStudent = can(session, "students.manage");
  const manage = can(session, "enrolment.manage");
  const assess = can(session, "progression.assess");
  const complete = can(session, "progression.complete");
  const admin = can(session, "progression.override");
  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const tab = profileTab(params.tab);

  // Fetched alongside the rest rather than first; nothing below needs more
  // than the id, so the sequential read was a round trip for nothing.
  const [student, enrolments, courses, programmes, attendance, assessments] =
    await Promise.all([
      getStudent(id),
      getEnrolmentsForStudent(id),
      manage ? getCourses(false, true) : Promise.resolve([]),
      getStudentProgress(id),
      getAttendanceForStudent(id),
      getStudentAssessments(id),
    ]);
  if (!student) notFound();
  const open = enrolments.filter(
    (enrolment) => enrolment.status === "ACTIVE" || enrolment.status === "WAITLISTED"
  );
  const active = enrolments.filter((enrolment) => enrolment.status === "ACTIVE");
  // Where their open place sits, by level, so "move up" knows which one to
  // close. Built from the enrolments the page already loaded.
  const openPlaceByLevel = Object.fromEntries(
    active.map((enrolment) => [
      enrolment.levelId,
      { id: enrolment.id, label: courseLabel(enrolment.course) },
    ])
  );
  const past = enrolments.filter(
    (enrolment) => enrolment.status !== "ACTIVE" && enrolment.status !== "WAITLISTED"
  );

  const meta = STUDENT_STATUS_META[student.status];
  const age = student.dateOfBirth ? ageInYears(student.dateOfBirth) : null;

  // The header line: age, then where they are. A swimmer in two programmes
  // has two places, and both are worth a glance.
  const facts = [
    age === null ? null : `${age} years old`,
    ...active.map((enrolment) => `${enrolment.level.name}, ${formatSlotShort(enrolment.course)} · ${enrolment.course.club.name}`),
  ].filter(Boolean);

  const canEnrol = manage && student.status === "ACTIVE";
  const tel = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <BackLink href="/students" current={fullName(student)}>
          Swimmers
        </BackLink>
        <PageHeader
          title={
            <HStack gap={2} vAlign="center" wrap="wrap">
              {fullName(student)}
              <Tag color={meta.color}>{meta.label}</Tag>
            </HStack>
          }
          description={facts.length > 0 ? facts.join(" · ") : "Not in a class at the moment"}
          actions={
            editStudent || canEnrol ? (
              <>
                {canEnrol ? <EnrolInCourseForStudent student={student} courses={courses} /> : null}
                {editStudent ? (
                  <>
                    <EditStudent student={student} variant="button" />
                    <ToggleStudentStatus student={student} />
                  </>
                ) : null}
              </>
            ) : null
          }
        />
      </VStack>

      {student.medicalNotes ? (
        <Banner
          status="error"
          title="Medical notes — read before they get in"
          collapsible={{ defaultIsOpen: true }}
        >
          <Text as="p" display="block" className="whitespace-pre-wrap">
            {student.medicalNotes}
          </Text>
        </Banner>
      ) : null}

      {/* At a glance: the two panels the desk reads while a parent waits.
          Side by side where there is room, stacked on a phone. */}
      <Grid columns={{ minWidth: 320, max: 2 }} gap={4}>
        <Panel title="Personal details">
          <Row label="Member number">
            {student.memberNumber ? (
              <Text hasTabularNumbers>{student.memberNumber}</Text>
            ) : (
              <Blank />
            )}
          </Row>
          <Row label="Date of birth">
            {student.dateOfBirth ? (
              <>
                {formatDate(student.dateOfBirth)}
                {age !== null ? <Text color="secondary"> · {age} years old</Text> : null}
              </>
            ) : (
              <Blank />
            )}
          </Row>
          <Row label="Joined">{formatDate(student.joinedOn)}</Row>
          <Row label="Photo consent">
            {student.photoConsent ? (
              <>
                Given
                {student.photoConsentOn ? (
                  <Text color="secondary"> on {formatDate(student.photoConsentOn)}</Text>
                ) : null}
              </>
            ) : (
              <Text color="secondary">Not given</Text>
            )}
          </Row>
          <Row label="Notes">
            {student.notes ? (
              <Text className="whitespace-pre-wrap">{student.notes}</Text>
            ) : (
              <Blank />
            )}
          </Row>
        </Panel>

        <Panel title="Contacts">
          <Row label="Contact">{student.contactName ?? <Blank />}</Row>
          <Row label="Phone">
            {student.contactPhone ? (
              <Link href={tel(student.contactPhone)} hasUnderline>
                {student.contactPhone}
              </Link>
            ) : (
              <Blank />
            )}
          </Row>
          <Row label="Email">
            {student.contactEmail ? (
              <Link href={`mailto:${student.contactEmail}`} hasUnderline className="break-all">
                {student.contactEmail}
              </Link>
            ) : (
              <Blank />
            )}
          </Row>
          {/* Shown when *either* half is present. Gating the number on the
              name having been filled in hid the most safety-critical field
              in the app: a record could hold a working emergency number and
              still render an em dash to whoever went looking for it. */}
          <Row label="In an emergency">
            {student.emergencyName || student.emergencyPhone ? (
              <>
                {student.emergencyName ?? <Text color="secondary">Name not recorded</Text>}
                {student.emergencyRelationship ? ` (${student.emergencyRelationship})` : ""}
                {student.emergencyPhone ? (
                  <Link href={tel(student.emergencyPhone)} hasUnderline display="block">
                    {student.emergencyPhone}
                  </Link>
                ) : null}
              </>
            ) : (
              <Blank />
            )}
          </Row>
        </Panel>
      </Grid>

      <VStack gap={4}>
        <ProfileTabs
          studentId={student.id}
          active={tab}
          items={[
            { key: "classes", label: "Classes", count: open.length },
            { key: "progress", label: "Progress", count: null },
            { key: "attendance", label: "Attendance", count: attendance.length },
            { key: "assessments", label: "Assessments", count: assessments.length },
          ]}
        />

        {tab === "classes" ? (
          <VStack gap={3} as="section" aria-label="Classes">
            {open.length === 0 ? (
              <EmptyState
                icon="waves"
                title="Not in any class at the moment"
                hint={
                  past.length > 0
                    ? "Their past places are below."
                    : "Enrol them and their progress starts from there."
                }
                action={
                  canEnrol ? (
                    <EnrolInCourseForStudent student={student} courses={courses} />
                  ) : undefined
                }
              />
            ) : (
              <EnrolmentTable entries={open} student={student} manage={manage} />
            )}

            {past.length > 0 ? (
              <Collapsible
                defaultIsOpen={false}
                trigger={
                  <Text color="secondary">
                    {past.length} past {past.length === 1 ? "place" : "places"}
                  </Text>
                }
              >
                <VStack paddingBlockStart={2}>
                  <EnrolmentTable entries={past} student={student} manage={false} />
                </VStack>
              </Collapsible>
            ) : null}
          </VStack>
        ) : null}

        {tab === "progress" ? (
          <VStack as="section" aria-label="Progress">
            <ProgressSection
              programmes={programmes}
              studentId={student.id}
              studentName={fullName(student)}
              manage={assess}
              complete={complete}
              admin={admin}
              courses={courses}
              openPlaceByLevel={openPlaceByLevel}
            />
          </VStack>
        ) : null}

        {tab === "attendance" ? (
          <VStack as="section" aria-label="Attendance">
            {attendance.length === 0 ? (
              <EmptyState
                icon="calendarCheck"
                title="No attendance taken with them on it yet"
                hint="Their marks appear here the first time an instructor takes attendance for their class."
              />
            ) : (
              <AttendanceTable records={attendance} />
            )}
          </VStack>
        ) : null}

        {tab === "assessments" ? (
          <VStack as="section" aria-label="Assessments">
            {assessments.length === 0 ? (
              <EmptyState
                icon="clipboardCheck"
                title="No assessments"
                hint="Book them onto a session from the Assessments page. A placement there earns the level for enrolment."
                action={
                  <Button
                    label="Assessment sessions"
                    variant="secondary"
                    href="/assessments"
                    icon={<AppIcon name="clipboardCheck" size="sm" />}
                  />
                }
              />
            ) : (
              <AssessmentList bookings={assessments} />
            )}
          </VStack>
        ) : null}
      </VStack>
    </VStack>
  );
}
