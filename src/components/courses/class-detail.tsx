import { cn } from "@/lib/utils";
import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/shadcn/table";

import type { ReactNode } from "react";

import { ArchiveCourse, EditCourse } from "./course-actions";
import {
  EndEnrolment,
  EnrolIntoCourse,
  PromoteFromWaitlist,
  TransferEnrolment,
} from "@/components/enrolment/enrolment-actions";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  capacityLabel,
  capacityTone,
  courseLabelWithSite as courseLabel,
  courseName,
  formatSlot,
  placesLeft,
} from "@/lib/courses/constants";
import type {
  CourseDetail,
  InstructorOption,
  RosterEntry,
} from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { PLACEMENT_META } from "@/lib/enrolment/constants";
import { formatDate } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import {
  MEDICAL_STATUS_META,
  STUDENT_STATUS_META,
  ageLabel,
  fullName,
} from "@/lib/students/constants";

type ClassAccess = {
  manage: boolean;
  admin: boolean;
  attendance: boolean;
  students: boolean;
};

/** Inspection is a full page: the roster leads, and the same permission-gated
 * enrolment actions used elsewhere remain the only write paths. */
export function ClassDetailView({
  course,
  roster,
  targets,
  levels,
  instructors,
  access,
  backHref,
  backLabel = "Classes",
  levelImage,
  coverName,
}: {
  course: CourseDetail;
  roster: RosterEntry[];
  targets: TransferTarget[];
  levels: LevelOption[];
  instructors: InstructorOption[];
  access: ClassAccess;
  backHref: string;
  backLabel?: string;
  levelImage?: ReactNode;
  coverName?: string;
}) {
  const active = roster.filter((entry) => entry.status === "ACTIVE");
  const waiting = roster.filter((entry) => entry.status === "WAITLISTED");
  const tone = capacityTone(active.length, course.capacity);
  const available = placesLeft(active.length, course.capacity);
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <div className={cn("min-w-0 flex flex-col gap-3", "[&_a]:min-h-11")}>
        <BackLink href={backHref} current={courseName(course)}>
          {backLabel}
        </BackLink>
        <PageHeader
          title={
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              {levelImage}
              {courseName(course)}
            </div>
          }
          description={`${course.club.name} · ${course.level.programme.name} · ${course.level.name}`}
          actions={
            access.manage && !course.archivedAt ? (
              <EnrolIntoCourse course={course} taken={active.length} />
            ) : undefined
          }
        />
        {course.archivedAt || tone ? (
          <div className="min-w-0 flex gap-2 items-center flex-wrap">
            {course.archivedAt ? (
              <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                {ARCHIVAL_STATUS_META.archived.label}
              </Tag>
            ) : null}
            {tone ? <Tag color={tone.color}>{tone.label}</Tag> : null}
          </div>
        ) : null}
      </div>

      <section
        aria-label="Class details"
        className={
          "min-w-0 space-y-4 border-t border-ui-border border-b border-ui-border p-0 py-4"
        }
      >
        <div className={cn("min-w-0 grid gap-4", "grid-cols-2 xl:grid-cols-4")}>
          <ClassFact
            label="Weekly schedule"
            value={formatSlot(course)}
            hint={`${course.durationMinutes} minutes`}
          />
          <ClassFact
            label="Pool area"
            value={course.location ?? "Not recorded"}
          />
          <ClassFact
            label="Instructor"
            value={course.instructor?.name ?? "Not assigned"}
            hint={coverName ? `${coverName} is covering today` : undefined}
          />
          <ClassFact
            label="Places"
            value={`${capacityLabel(active.length, course.capacity)}${course.capacity === null ? "" : " enrolled"}`}
            hint={
              course.archivedAt
                ? "Archived · closed to new enrolments"
                : available === null
                  ? "No capacity limit"
                  : `${available} available · ${waiting.length} waiting`
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="enrolled-heading"
        className="min-w-0 flex flex-col gap-3"
      >
        <div
          className={
            "min-w-0 flex gap-3 items-center justify-between flex-wrap"
          }
        >
          <h2
            id="enrolled-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Enrolled swimmers ({active.length})
          </h2>
          {access.attendance && !course.archivedAt ? (
            <Button variant="outline" asChild={true}>
              <UiLink href={`/courses/${course.id}/class`}>
                {<AppIcon name="clipboardList" size="sm" />}
                {"Attendance & progress"}
              </UiLink>
            </Button>
          ) : null}
        </div>
        {active.length ? (
          <ClassRoster
            entries={active}
            course={course}
            access={access}
            targets={targets}
          />
        ) : (
          <EmptyState
            compact
            icon="users"
            title="No enrolled swimmers"
            hint={
              course.archivedAt
                ? "There are no current enrolments in this archived class."
                : waiting.length
                  ? "Swimmers on the waitlist appear below. A place must be available before they can enrol."
                  : access.manage
                    ? "Choose Enrol a swimmer to add the first place in this class."
                    : "Swimmers will appear here when they are enrolled."
            }
          />
        )}
      </section>

      <section
        aria-labelledby="waitlist-heading"
        className="min-w-0 flex flex-col gap-3"
      >
        <h2
          id="waitlist-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Waitlist ({waiting.length})
        </h2>
        {waiting.length ? (
          <>
            <span className="text-sm text-ui-muted-foreground">
              Waiting swimmers do not hold a place. Enrolling from the waitlist
              checks capacity again.
            </span>
            <ClassRoster
              entries={waiting}
              course={course}
              access={access}
              targets={targets}
              waiting
            />
          </>
        ) : (
          <span className="text-sm text-ui-muted-foreground">
            No swimmers are waiting for this class.
          </span>
        )}
      </section>

      {access.admin ? (
        <section className="min-w-0 space-y-4 border-t border-ui-border p-0 pt-4">
          <div
            className={
              "min-w-0 flex gap-3 items-center justify-between flex-wrap"
            }
          >
            <div className="min-w-0 flex flex-col gap-1">
              <h2 className="text-xl font-semibold tracking-tight">
                Manage class
              </h2>
              <span className="text-sm text-ui-muted-foreground">
                Update the weekly schedule, instructor or capacity.
              </span>
            </div>
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              <EditCourse
                course={course}
                levels={levels}
                instructors={instructors}
                variant="button"
              />
              <ArchiveCourse course={course} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ClassFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <span className="text-sm text-ui-muted-foreground">{label}</span>
      <span className="text-sm text-ui-foreground font-medium">{value}</span>
      {hint ? (
        <span className="text-sm text-ui-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function ClassRoster({
  entries,
  course,
  access,
  targets,
  waiting = false,
}: {
  entries: RosterEntry[];
  course: CourseDetail;
  access: ClassAccess;
  targets: TransferTarget[];
  waiting?: boolean;
}) {
  const label = courseLabel(course);
  return (
    <Table
      aria-label={waiting ? "Waitlisted swimmers" : "Enrolled swimmers"}
      className="w-full table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal"
    >
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Swimmer</TableHead>
          <TableHead scope="col" className={"hidden md:table-cell"}>
            Placement
          </TableHead>
          <TableHead
            scope="col"
            className={"hidden lg:table-cell w-32 max-w-none"}
          >
            {waiting ? "Waiting since" : "Enrolled since"}
          </TableHead>
          {access.manage ? (
            <TableHead
              scope="col"
              className={"hidden md:table-cell w-48 max-w-none"}
            >
              <span className={cn("text-sm text-ui-foreground", "sr-only")}>
                Enrolment actions
              </span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const student = entry.student;
          const placementDiffers = entry.level.id !== course.levelId;
          const inactive = student.status !== "ACTIVE";
          return (
            <TableRow key={entry.id}>
              <TableCell>
                <div className="min-w-0 flex flex-col gap-2">
                  <div className="min-w-0 flex gap-2 items-center flex-wrap">
                    {access.students ? (
                      <UiLink
                        href={`/students/${student.id}`}
                        className={cn(
                          "text-ui-foreground underline-offset-4 hover:underline font-semibold",
                          "inline-flex min-h-11 items-center",
                        )}
                      >
                        {fullName(student)}
                      </UiLink>
                    ) : (
                      <span className="text-sm text-ui-foreground font-semibold">
                        {fullName(student)}
                      </span>
                    )}
                    {student.medicalNotes ? (
                      <Tag color={MEDICAL_STATUS_META.notes.color}>
                        {MEDICAL_STATUS_META.notes.label}
                      </Tag>
                    ) : null}
                    {inactive ? (
                      <Tag color={STUDENT_STATUS_META[student.status].color}>
                        {STUDENT_STATUS_META[student.status].label}
                      </Tag>
                    ) : null}
                  </div>
                  <span className="text-sm text-ui-muted-foreground">
                    {student.memberNumber ?? "No member number"} ·{" "}
                    {student.dateOfBirth
                      ? `Age ${ageLabel(student.dateOfBirth)}`
                      : "Age not recorded"}
                  </span>
                  <div
                    className={cn("min-w-0 flex flex-col gap-1", "md:hidden")}
                  >
                    <Placement entry={entry} differs={placementDiffers} />
                  </div>
                  <span
                    className={cn(
                      "text-sm text-ui-muted-foreground",
                      "lg:hidden",
                    )}
                  >
                    {waiting ? "Waiting since" : "Enrolled since"}{" "}
                    {formatDate(entry.startedOn)}
                  </span>
                  {entry.scheduledEndOn ? (
                    <span className="text-sm text-ui-muted-foreground">
                      Unenrols {formatDate(entry.scheduledEndOn)}
                    </span>
                  ) : null}
                  {access.manage ? (
                    <div
                      className={cn(
                        "min-w-0 flex gap-2 items-center flex-wrap",
                        "md:hidden",
                      )}
                    >
                      <RosterActions
                        entry={entry}
                        classLabel={label}
                        targets={targets}
                        canPromote={waiting && !course.archivedAt}
                      />
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className={"hidden md:table-cell"}>
                <div className="min-w-0 flex flex-col gap-1">
                  <Placement entry={entry} differs={placementDiffers} />
                </div>
              </TableCell>
              <TableCell className={"hidden lg:table-cell"}>
                <span className="text-sm text-ui-muted-foreground">
                  {formatDate(entry.startedOn)}
                </span>
              </TableCell>
              {access.manage ? (
                <TableCell className={"hidden md:table-cell"}>
                  <div
                    className={
                      "min-w-0 flex gap-2 items-center justify-end flex-wrap"
                    }
                  >
                    <RosterActions
                      entry={entry}
                      classLabel={label}
                      targets={targets}
                      canPromote={waiting && !course.archivedAt}
                    />
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RosterActions({
  entry,
  classLabel,
  targets,
  canPromote,
}: {
  entry: RosterEntry;
  classLabel: string;
  targets: TransferTarget[];
  canPromote: boolean;
}) {
  const active = entry.student.status === "ACTIVE";
  return (
    <>
      {canPromote && active ? (
        <PromoteFromWaitlist
          enrolment={entry}
          variant="button"
          classLabel={classLabel}
        />
      ) : null}
      {active ? (
        <TransferEnrolment
          enrolment={entry}
          targets={targets}
          classLabel={classLabel}
        />
      ) : null}
      <EndEnrolment enrolment={entry} classLabel={classLabel} />
    </>
  );
}

function Placement({
  entry,
  differs,
}: {
  entry: RosterEntry;
  differs: boolean;
}) {
  return (
    <>
      <div className="min-w-0 flex gap-2 items-center">
        {differs ? (
          <Tag color={PLACEMENT_META.otherLevel.color}>{entry.level.name}</Tag>
        ) : (
          <span className="text-sm text-ui-foreground">{entry.level.name}</span>
        )}
      </div>
      <span className="text-sm text-ui-muted-foreground">
        {entry.programme.name}
      </span>
      {entry.placementReason ? (
        <span className="text-sm text-ui-muted-foreground">
          Placement: {entry.placementReason}
        </span>
      ) : null}
    </>
  );
}
