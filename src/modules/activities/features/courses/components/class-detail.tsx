import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
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

import { ArchiveCourse, EditCourse } from "@/modules/activities/features/courses/components/course-actions";
import {
  EndEnrolment,
  EnrolIntoCourse,
  PromoteFromWaitlist,
  TransferEnrolment,
} from "@/modules/activities/shared/enrolment/components/enrolment-actions";
import { AppIcon } from "@/components/ui-kit/app-icon";
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
} from "@/modules/activities/shared/courses/constants";
import type {
  CourseDetail,
  InstructorOption,
  RosterEntry,
} from "@/modules/activities/shared/courses/data/courses";
import type { LevelOption } from "@/modules/activities/shared/curriculum/data/curriculum";
import type { TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import { PLACEMENT_META } from "@/modules/activities/shared/enrolment/constants";
import { formatDate } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import {
  MEDICAL_STATUS_META,
  STUDENT_STATUS_META,
  ageLabel,
  fullName,
} from "@/modules/activities/shared/students/constants";

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
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={
          <span className="min-w-0 flex gap-2 items-center flex-wrap">
            {levelImage}
            {courseName(course)}
          </span>
        }
        description={`${course.club.name} · ${course.level.programme.name} · ${course.level.name}`}
        status={
          course.archivedAt || tone ? (
            <>
              {course.archivedAt ? (
                <Tag meta={ARCHIVAL_STATUS_META.archived} />
              ) : null}
              {tone ? <Tag meta={tone} /> : null}
            </>
          ) : null
        }
        actions={
          access.manage && !course.archivedAt ? (
            <EnrolIntoCourse course={course} taken={active.length} />
          ) : undefined
        }
      />

      <section aria-label="Class details" className="min-w-0">
        <div className="min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  ? `No limit · ${waiting.length} waiting`
                  : `${available} available · ${waiting.length} waiting`
            }
          />
        </div>
      </section>

      <section aria-labelledby="enrolled-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="enrolled-heading">
            Enrolled swimmers ({active.length})
          </h2>
          {access.attendance && !course.archivedAt ? (
            <Button variant="outline" asChild={true}>
              <UiLink href={`/courses/${course.id}/class`}>
                <AppIcon name="clipboardList" size="sm" />
                Attendance and progress
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

      <section aria-labelledby="waitlist-heading" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="waitlist-heading">Waitlist ({waiting.length})</h2>
        </div>
        {waiting.length ? (
          <>
            <p className="text-sm text-ui-muted-foreground">
              Waiting swimmers do not hold a place. Enrolling from the waitlist
              checks capacity again.
            </p>
            <ClassRoster
              entries={waiting}
              course={course}
              access={access}
              targets={targets}
              waiting
            />
          </>
        ) : (
          <p className="text-sm text-ui-muted-foreground">
            No swimmers are waiting for this class.
          </p>
        )}
      </section>

      {access.admin ? (
        <section aria-labelledby="manage-heading" className="pc-panel">
          <div className="pc-panel-head">
            <h2 id="manage-heading">Manage class</h2>
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              <ArchiveCourse course={course} />
              <EditCourse
                course={course}
                levels={levels}
                instructors={instructors}
              />
            </div>
          </div>
          <p className="text-sm text-ui-muted-foreground">
            Update the weekly schedule, instructor or capacity.
          </p>
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
    <div className="pc-panel">
      <div className="min-w-0 flex flex-col">
        <span className="text-xs text-ui-muted-foreground">{label}</span>
        <span className="text-sm text-ui-foreground font-semibold">{value}</span>
        {hint ? (
          <span className="text-xs text-ui-muted-foreground">{hint}</span>
        ) : null}
      </div>
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
  const since = waiting ? "Waiting since" : "Enrolled since";
  const actions = (entry: RosterEntry) => (
    <RosterActions
      entry={entry}
      classLabel={label}
      targets={targets}
      canPromote={waiting && !course.archivedAt}
    />
  );
  return (
    <>
      {/* Phones and tablets: closed rows, actions in the row's trail. */}
      <div className="lg:hidden">
        <ul
          className="pc-rows"
          aria-label={waiting ? "Waitlisted swimmers" : "Enrolled swimmers"}
        >
          {entries.map((entry) => (
            <li key={entry.id} className="pc-row">
              <Swimmer entry={entry} access={access} />
              <div className="pc-row-body">
                <Placement
                  entry={entry}
                  differs={entry.level.id !== course.levelId}
                />
                <span className="pc-row-hint">
                  {since} {formatDate(entry.startedOn)}
                  {entry.scheduledEndOn
                    ? ` · Unenrols ${formatDate(entry.scheduledEndOn)}`
                    : ""}
                </span>
              </div>
              {access.manage ? (
                <div className="pc-row-trail">{actions(entry)}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {/* From 1024px: a table with every column visible. */}
      <Table
        aria-label={waiting ? "Waitlisted swimmers" : "Enrolled swimmers"}
        containerClassName="hidden lg:block"
        className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal"
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Swimmer</TableHead>
            <TableHead scope="col">Placement</TableHead>
            <TableHead scope="col">{since}</TableHead>
            {access.manage ? (
              <TableHead scope="col">
                <span className="sr-only">Enrolment actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Swimmer entry={entry} access={access} />
              </TableCell>
              <TableCell>
                <div className="min-w-0 flex flex-col">
                  <Placement
                    entry={entry}
                    differs={entry.level.id !== course.levelId}
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-0 flex flex-col">
                  <span className="text-sm">{formatDate(entry.startedOn)}</span>
                  {entry.scheduledEndOn ? (
                    <span className="text-xs text-ui-muted-foreground">
                      Unenrols {formatDate(entry.scheduledEndOn)}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              {access.manage ? (
                <TableCell>
                  <div className="min-w-0 flex gap-2 items-center justify-end flex-wrap">
                    {actions(entry)}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** Initials, the name (a link when the role has Swimmers), status tags, then member number and age. */
function Swimmer({ entry, access }: { entry: RosterEntry; access: ClassAccess }) {
  const student = entry.student;
  return (
    <div className="min-w-0 flex gap-3 items-center">
      <Avatar aria-hidden="true">
        <AvatarFallback>
          {student.firstName.charAt(0)}
          {student.lastName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex flex-col items-start">
        {access.students ? (
          <UiLink
            href={`/students/${student.id}`}
            className="-my-3 inline-flex min-h-11 items-center font-semibold text-ui-foreground underline-offset-4 hover:underline"
          >
            {fullName(student)}
          </UiLink>
        ) : (
          <span className="text-sm text-ui-foreground font-semibold">
            {fullName(student)}
          </span>
        )}
        {student.memberNumber || student.dateOfBirth ? (
          <span className="text-xs text-ui-muted-foreground">
            {[
              student.memberNumber ? `#${student.memberNumber}` : null,
              student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
        {student.hasMedicalNotes || student.status !== "ACTIVE" ? (
          <div className="mt-1 min-w-0 flex gap-2 items-center flex-wrap">
            {student.hasMedicalNotes ? (
              <Tag meta={MEDICAL_STATUS_META.notes} />
            ) : null}
            {student.status !== "ACTIVE" ? (
              <Tag meta={STUDENT_STATUS_META[student.status]} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
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
          <Tag meta={PLACEMENT_META.otherLevel} label={entry.level.name} />
        ) : (
          <span className="text-sm text-ui-foreground">{entry.level.name}</span>
        )}
      </div>
      <span className="text-xs text-ui-muted-foreground">
        {entry.programme.name}
      </span>
      {entry.placementReason ? (
        <span className="text-xs text-ui-muted-foreground">
          Placement: {entry.placementReason}
        </span>
      ) : null}
    </>
  );
}
