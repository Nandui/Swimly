import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { EditStudent, ToggleStudentStatus } from "@/components/students/student-actions";
import {
  EndEnrolment,
  EnrolInCourseForStudent,
  PromoteFromWaitlist,
} from "@/components/enrolment/enrolment-actions";
import { ProgressSection } from "@/components/progression/progress-section";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import { getAttendanceForStudent, type StudentAttendance } from "@/lib/attendance/data/register";
import { can } from "@/lib/authz";
import { getStudentProgress } from "@/lib/progression/data/progress";
import { BOOKING_STATUS_META, sessionLabel } from "@/lib/assessments/constants";
import { getStudentAssessments } from "@/lib/assessments/data/assessments";
import { courseLabel, courseName, formatSlotShort } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import {
  getEnrolmentsForStudent,
  type StudentEnrolment,
} from "@/lib/enrolment/data/enrolments";
import { ageInYears, formatDate } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { STUDENT_STATUS_META, fullName } from "@/lib/students/constants";
import { getStudent } from "@/lib/students/data/students";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const session = await pageSession();
  // One flag per permission, because this page hangs three different powers
  // off what used to be one tier: editing the swimmer, moving them between
  // classes, and signing a level off.
  const editStudent = can(session, "students.manage");
  const manage = can(session, "enrolment.manage");
  const assess = can(session, "progression.assess");
  const admin = can(session, "progression.override");
  const { id } = await props.params;

  // Fetched alongside the rest rather than first; nothing below needs more
  // than the id, so the sequential read was a round trip for nothing.
  const [student, enrolments, courses, programmes, attendance, assessments] = await Promise.all([
    getStudent(id),
    getEnrolmentsForStudent(id),
    manage ? getCourses() : Promise.resolve([]),
    getStudentProgress(id),
    getAttendanceForStudent(id),
    getStudentAssessments(id),
  ]);
  if (!student) notFound();
  const open = enrolments.filter(
    (enrolment) => enrolment.status === "ACTIVE" || enrolment.status === "WAITLISTED"
  );
  // Where their open place sits, by level, so "move up" knows which one to
  // close. Built from the enrolments the page already loaded.
  const openPlaceByLevel = Object.fromEntries(
    enrolments
      .filter((enrolment) => enrolment.status === "ACTIVE")
      .map((enrolment) => [
        enrolment.levelId,
        { id: enrolment.id, label: courseLabel(enrolment.course) },
      ])
  );
  const past = enrolments.filter(
    (enrolment) => enrolment.status !== "ACTIVE" && enrolment.status !== "WAITLISTED"
  );

  const meta = STUDENT_STATUS_META[student.status];
  const age = student.dateOfBirth ? ageInYears(student.dateOfBirth) : null;

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
          description={
            age === null
              ? `Joined ${formatDate(student.joinedOn)}`
              : `${age} years old · joined ${formatDate(student.joinedOn)}`
          }
          actions={
            editStudent ? (
              <>
                <EditStudent student={student} variant="button" />
                <ToggleStudentStatus student={student} />
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <div className="overflow-hidden rounded-md border">
          <dl>
            <Row label="Member number">
              {student.memberNumber ? (
                <span className="tabular-nums">{student.memberNumber}</span>
              ) : (
                <Blank />
              )}
            </Row>
            <Row label="Date of birth">
              {student.dateOfBirth ? formatDate(student.dateOfBirth) : <Blank />}
            </Row>
            <Row label="Contact">{student.contactName ?? <Blank />}</Row>
            <Row label="Phone">{student.contactPhone ?? <Blank />}</Row>
            <Row label="Email">
              {student.contactEmail ? (
                <a
                  href={`mailto:${student.contactEmail}`}
                  className="text-primary underline-offset-4 hover:underline"
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
                    <span className="block text-muted-foreground">{student.emergencyPhone}</span>
                  ) : null}
                </>
              ) : (
                <Blank />
              )}
            </Row>
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
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Classes</h2>
          {manage && student.status === "ACTIVE" ? (
            <EnrolInCourseForStudent student={student} courses={courses} />
          ) : null}
        </div>

        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not in any class at the moment.
            {past.length > 0 ? " Their past places are below." : ""}
          </p>
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

      {assessments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Assessments</h2>
          <ul className="overflow-hidden rounded-md border">
            {assessments.map((booking) => {
              const meta = BOOKING_STATUS_META[booking.status];
              return (
                <li
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b p-3 text-sm last:border-0"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/assessments/${booking.session.id}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {sessionLabel(booking.session)}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {booking.session.programme.name}
                      {booking.session.type ? ` · ${booking.session.type.name}` : ""}
                      {booking.outcomeLevel ? (
                        <>
                          {" · placed at "}
                          <span className="font-medium text-foreground">{booking.outcomeLevel.name}</span>
                          {booking.assessedByName ? ` by ${booking.assessedByName}` : ""}
                          {booking.outcomeNote ? ` — ${booking.outcomeNote}` : ""}
                        </>
                      ) : null}
                    </span>
                  </span>
                  <Tag color={meta.color}>{meta.label}</Tag>
                </li>
              );
            })}
          </ul>
          {assessments.some((b) => b.outcomeLevel) ? (
            <p className="max-w-prose text-xs text-muted-foreground">
              A placement counts as having earned that level and every level below it in the
              programme, so they can be enrolled there without a reason being asked for.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Progress</h2>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Attendance</h2>
        {attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No register has been taken with them on it yet.
          </p>
        ) : (
          <AttendanceTable records={attendance} />
        )}
      </section>

      {student.notes ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <p className="max-w-prose text-sm whitespace-pre-wrap text-muted-foreground">
            {student.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-0.5 border-b px-3 py-2 last:border-0">
      <dt className="w-40 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Blank() {
  return <span className="text-muted-foreground/70">—</span>;
}

function EnrolmentTable({
  entries,
  student,
  manage,
}: {
  entries: StudentEnrolment[];
  student: { firstName: string; lastName: string };
  manage: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Class
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Level
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Since
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th scope="col" className="w-20 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const meta = ENROLMENT_STATUS_META[entry.status];
            return (
              <tr
                key={entry.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link
                    href={`/courses/${entry.course.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {courseName(entry.course)}
                  </Link>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {formatSlotShort(entry.course)}
                    {entry.course.instructor ? ` · ${entry.course.instructor.name}` : ""}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {entry.programme.name} · {entry.level.name} · since{" "}
                    {formatDate(entry.startedOn)}
                  </span>
                  {entry.placementReason ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Placed here: {entry.placementReason}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-md:hidden">
                  {entry.level.name}
                  <span className="block text-xs">{entry.programme.name}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-md:hidden">
                  {formatDate(entry.startedOn)}
                  {entry.endedOn ? (
                    <span className="block text-xs">to {formatDate(entry.endedOn)}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Tag color={meta.color}>{meta.label}</Tag>
                </td>
                <td className="px-3 py-2">
                  {manage ? (
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                      {entry.status === "WAITLISTED" ? (
                        <PromoteFromWaitlist enrolment={{ ...entry, student }} />
                      ) : null}
                      <EndEnrolment
                        enrolment={{ ...entry, student }}
                        classLabel={courseLabel(entry.course)}
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceTable({ records }: { records: StudentAttendance[] }) {
  const missed = records.filter((record) => record.status === "ABSENT").length;

  return (
    <div className="space-y-2">
      <p className="max-w-prose text-sm text-muted-foreground">
        The last{" "}
        <span className="font-medium text-foreground tabular-nums">{records.length}</span>{" "}
        {records.length === 1 ? "class" : "classes"}
        {missed > 0 ? (
          <>
            , <span className="font-medium text-(--tag-red-fg) tabular-nums">{missed}</span> of them
            missed
          </>
        ) : null}
        .
      </p>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-sidebar">
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Date
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
              >
                Class
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const meta = ATTENDANCE_STATUS_META[record.status];
              return (
                <tr key={record.id} className="border-b transition-colors last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2 whitespace-nowrap text-foreground tabular-nums">
                    {formatDate(record.date)}
                    <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                      {courseName(record.course)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-md:hidden">
                    {courseName(record.course)}
                    <span className="block text-xs">{formatSlotShort(record.course)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Tag color={meta.color}>{meta.label}</Tag>
                    {record.note ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{record.note}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
