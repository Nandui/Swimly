import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, GraduationCap, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { ArchiveCourse, EditCourse } from "@/components/courses/course-actions";
import {
  EndEnrolment,
  EnrolIntoCourse,
  PromoteFromWaitlist,
  TransferEnrolment,
} from "@/components/enrolment/enrolment-actions";
import { canManage, isAdmin } from "@/lib/authz";
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
import { pageSession } from "@/lib/page-guards";
import { ageLabel, fullName } from "@/lib/students/constants";
import { getStudentOptions } from "@/lib/students/data/students";

export const metadata: Metadata = { title: "Course" };

export default async function CoursePage(props: PageProps<"/courses/[id]">) {
  const session = await pageSession();
  const manage = canManage(session.user.role);
  const admin = isAdmin(session.user.role);
  const { id } = await props.params;

  const course = await getCourse(id);
  if (!course) notFound();

  const [roster, students, targets, levels, instructors] = await Promise.all([
    getRoster(id),
    manage ? getStudentOptions() : Promise.resolve([]),
    manage ? getTransferTargets(id) : Promise.resolve([]),
    admin ? getLevelOptions() : Promise.resolve([]),
    admin ? getInstructorOptions() : Promise.resolve([]),
  ]);

  const active = roster.filter((entry) => entry.status === "ACTIVE");
  const waiting = roster.filter((entry) => entry.status === "WAITLISTED");
  const tone = capacityTone(active.length, course.capacity);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/courses"
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Courses
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {courseName(course)}
              {course.archivedAt ? <Tag color="gray">Archived</Tag> : null}
              {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
            </span>
          }
          description={
            `${formatSlot(course)} · ${course.level.programme.name} · ${course.level.name}` +
            (course.location ? ` · ${course.location}` : "") +
            (course.instructor ? ` · ${course.instructor.name}` : " · nobody assigned")
          }
          actions={
            <>
              {manage && !course.archivedAt ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/courses/${course.id}/register`}>
                    <ClipboardList className="size-4" />
                    Take the register
                  </Link>
                </Button>
              ) : null}
              {manage ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/courses/${course.id}/assess`}>
                    <GraduationCap className="size-4" />
                    Assess
                  </Link>
                </Button>
              ) : null}
              {manage && !course.archivedAt ? (
                <EnrolIntoCourse course={course} taken={active.length} students={students} />
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
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {capacityLabel(active.length, course.capacity)}
        </span>{" "}
        places taken
        {waiting.length > 0 ? (
          <>
            , with{" "}
            <span className="font-medium text-(--tag-yellow-fg) tabular-nums">
              {waiting.length}
            </span>{" "}
            waiting
          </>
        ) : null}
        .
      </p>

      {roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody in this class yet"
          hint="Enrol a swimmer and they will appear on the roster and on every register from then on."
          action={
            manage && !course.archivedAt ? (
              <EnrolIntoCourse course={course} taken={0} students={students} />
            ) : null
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Roster</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has a place yet — everyone below is waiting.
              </p>
            ) : (
              <RosterTable
                entries={active}
                courseLevelId={course.levelId}
                classLabel={courseLabel(course)}
                manage={manage}
                targets={targets}
              />
            )}
          </section>

          {waiting.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Waiting</h2>
              <RosterTable
                entries={waiting}
                courseLevelId={course.levelId}
                classLabel={courseLabel(course)}
                manage={manage}
                targets={targets}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
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
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Swimmer
            </th>
            <th
              scope="col"
              className="w-12 px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Age
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
            <th scope="col" className="w-24 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const meta = ENROLMENT_STATUS_META[entry.status];
            const outOfSequence = entry.level.id !== courseLevelId;
            return (
              <tr
                key={entry.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link
                    href={`/students/${entry.student.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {fullName(entry.student)}
                  </Link>
                  {entry.student.medicalNotes ? (
                    <Tag color="red" className="ml-2">
                      Medical
                    </Tag>
                  ) : null}
                  {outOfSequence ? (
                    <Tag color="purple" className="ml-2">
                      {entry.level.name}
                    </Tag>
                  ) : null}
                  {entry.placementReason ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Placed here: {entry.placementReason}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {ageLabel(entry.student.dateOfBirth)} · since{" "}
                    {formatDate(entry.startedOn)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                  {ageLabel(entry.student.dateOfBirth)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-md:hidden">
                  {formatDate(entry.startedOn)}
                </td>
                <td className="px-3 py-2">
                  <Tag color={meta.color}>{meta.label}</Tag>
                </td>
                <td className="px-3 py-2">
                  {manage ? (
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                      {entry.status === "WAITLISTED" ? (
                        <PromoteFromWaitlist enrolment={entry} />
                      ) : null}
                      <TransferEnrolment enrolment={entry} targets={targets} />
                      <EndEnrolment enrolment={entry} classLabel={classLabel} />
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

