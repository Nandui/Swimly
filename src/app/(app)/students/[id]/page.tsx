import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, ChevronLeft, ClipboardCheck, Waves } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { WrongClub } from "@/components/clubs/wrong-club";
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
import { getCurrentClub } from "@/lib/clubs/current";
import { courseLabel, formatSlotShort } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { getEnrolmentsForStudent } from "@/lib/enrolment/data/enrolments";
import { ageInYears, formatDate } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { getStudentProgress } from "@/lib/progression/data/progress";
import { STUDENT_STATUS_META, fullName } from "@/lib/students/constants";
import { getStudent } from "@/lib/students/data/students";

export const metadata: Metadata = { title: "Student" };

/** A swimmer's profile.
 *
 *  Three layers, not one scroll. The header carries what the desk asks first:
 *  who, how old, which class. Under it, the things that must never be far
 *  away — medical notes, then personal details and contacts side by side.
 *  Everything that grows week on week — classes, progress, attendance,
 *  assessments — sits behind a tab, one section on screen at a time. */
export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const session = await pageSession();
  // One flag per permission, because this page hangs three different powers
  // off what used to be one tier: editing the swimmer, moving them between
  // classes, and signing a level off.
  const editStudent = can(session, "students.manage");
  const manage = can(session, "enrolment.manage");
  const assess = can(session, "progression.assess");
  const admin = can(session, "progression.override");
  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const tab = profileTab(params.tab);

  // Fetched alongside the rest rather than first; nothing below needs more
  // than the id, so the sequential read was a round trip for nothing.
  const [student, enrolments, courses, programmes, attendance, assessments, { club }] =
    await Promise.all([
      getStudent(id),
      getEnrolmentsForStudent(id),
      manage ? getCourses() : Promise.resolve([]),
      getStudentProgress(id),
      getAttendanceForStudent(id),
      getStudentAssessments(id),
      getCurrentClub(),
    ]);
  if (!student) notFound();
  // Every picker below is the current club's, so a swimmer from the other
  // one is shown only as a way to switch.
  if (student.clubId !== club.id) {
    return <WrongClub what={fullName(student)} owner={student.club} current={club} />;
  }

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
    ...active.map((enrolment) => `${enrolment.level.name}, ${formatSlotShort(enrolment.course)}`),
  ].filter(Boolean);

  const canEnrol = manage && student.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Students
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {fullName(student)}
              <Tag color={meta.color}>{meta.label}</Tag>
            </span>
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
      </div>

      {student.medicalNotes ? (
        <details className="rounded-md border border-(--tag-red-bg) bg-(--tag-red-bg)/50 px-3 py-2 [&[open]>summary]:mb-1.5">
          <summary className="cursor-pointer text-[13px] font-medium text-(--tag-red-fg)">
            Medical notes — read before they get in
          </summary>
          <p className="text-sm whitespace-pre-wrap text-foreground">{student.medicalNotes}</p>
        </details>
      ) : null}

      {/* At a glance: the two panels the desk reads while a parent waits.
          Side by side where there is room, stacked on a phone. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Personal details">
          <dl>
            <Row label="Member number">
              {student.memberNumber ? (
                <span className="tabular-nums">{student.memberNumber}</span>
              ) : (
                <Blank />
              )}
            </Row>
            <Row label="Date of birth">
              {student.dateOfBirth ? (
                <>
                  {formatDate(student.dateOfBirth)}
                  {age !== null ? (
                    <span className="text-muted-foreground"> · {age} years old</span>
                  ) : null}
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
                    <span className="text-muted-foreground">
                      {" "}
                      on {formatDate(student.photoConsentOn)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Not given</span>
              )}
            </Row>
            <Row label="Notes">
              {student.notes ? (
                <span className="whitespace-pre-wrap">{student.notes}</span>
              ) : (
                <Blank />
              )}
            </Row>
          </dl>
        </Panel>

        <Panel title="Contacts">
          <dl>
            <Row label="Contact">{student.contactName ?? <Blank />}</Row>
            <Row label="Phone">
              {student.contactPhone ? (
                <a
                  href={`tel:${student.contactPhone.replace(/\s+/g, "")}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {student.contactPhone}
                </a>
              ) : (
                <Blank />
              )}
            </Row>
            <Row label="Email">
              {student.contactEmail ? (
                <a
                  href={`mailto:${student.contactEmail}`}
                  className="break-all text-primary underline-offset-4 hover:underline"
                >
                  {student.contactEmail}
                </a>
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
                  {student.emergencyName ?? (
                    <span className="text-muted-foreground">Name not recorded</span>
                  )}
                  {student.emergencyRelationship ? ` (${student.emergencyRelationship})` : ""}
                  {student.emergencyPhone ? (
                    <a
                      href={`tel:${student.emergencyPhone.replace(/\s+/g, "")}`}
                      className="block text-primary underline-offset-4 hover:underline"
                    >
                      {student.emergencyPhone}
                    </a>
                  ) : null}
                </>
              ) : (
                <Blank />
              )}
            </Row>
          </dl>
        </Panel>
      </div>

      <div className="space-y-4">
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
          <section className="space-y-3" aria-label="Classes">
            {open.length === 0 ? (
              <EmptyState
                icon={Waves}
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
              <details className="rounded-md border px-3 py-2 [&[open]>summary]:mb-2">
                <summary className="cursor-pointer text-[13px] text-muted-foreground">
                  {past.length} past {past.length === 1 ? "place" : "places"}
                </summary>
                <EnrolmentTable entries={past} student={student} manage={false} />
              </details>
            ) : null}
          </section>
        ) : null}

        {tab === "progress" ? (
          <section aria-label="Progress">
            <ProgressSection
              programmes={programmes}
              studentId={student.id}
              studentName={fullName(student)}
              manage={assess}
              admin={admin}
              courses={courses}
              openPlaceByLevel={openPlaceByLevel}
            />
          </section>
        ) : null}

        {tab === "attendance" ? (
          <section aria-label="Attendance">
            {attendance.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No register has been taken with them on it yet"
                hint="Their marks appear here the first time an instructor takes attendance for their class."
              />
            ) : (
              <AttendanceTable records={attendance} />
            )}
          </section>
        ) : null}

        {tab === "assessments" ? (
          <section aria-label="Assessments">
            {assessments.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No assessments"
                hint="Book them onto a session from the Assessments page. A placement there earns the level for enrolment."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/assessments">
                      <ClipboardCheck className="size-4" />
                      Assessment sessions
                    </Link>
                  </Button>
                }
              />
            ) : (
              <AssessmentList bookings={assessments} />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
