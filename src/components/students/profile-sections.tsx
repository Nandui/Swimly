import Link from "next/link";
import { Tag } from "@/components/ui-kit/tag";
import { EndEnrolment, PromoteFromWaitlist } from "@/components/enrolment/enrolment-actions";
import { BOOKING_STATUS_META, sessionLabel } from "@/lib/assessments/constants";
import type { StudentAssessment } from "@/lib/assessments/data/assessments";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import type { StudentAttendance } from "@/lib/attendance/data/register";
import { courseLabel, courseName, formatSlotShort } from "@/lib/courses/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type { StudentEnrolment } from "@/lib/enrolment/data/enrolments";
import { formatDate } from "@/lib/format";

/** The pieces of a swimmer's profile. Server components: they render the
 *  client action buttons but hold no state of their own. */

/** A bordered panel with a titled head, the same head the tables use, so the
 *  at-a-glance pair and the lists below read as one family. */
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between gap-3 border-b bg-sidebar px-3 py-2">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b px-3 py-2 last:border-0">
      <dt className="w-28 shrink-0 text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function Blank() {
  return <span className="text-muted-foreground/70">—</span>;
}

export function EnrolmentTable({
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

export function AttendanceTable({ records }: { records: StudentAttendance[] }) {
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

export function AssessmentList({ bookings }: { bookings: StudentAssessment[] }) {
  return (
    <div className="space-y-3">
      <ul className="overflow-hidden rounded-md border">
        {bookings.map((booking) => {
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
      {bookings.some((booking) => booking.outcomeLevel) ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          A placement counts as having earned that level and every level below it in the
          programme, so they can be enrolled there without a reason being asked for.
        </p>
      ) : null}
    </div>
  );
}
