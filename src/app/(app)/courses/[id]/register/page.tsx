import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/attendance/register-form";
import { WrongClub } from "@/components/clubs/wrong-club";
import { canMarkRegister } from "@/lib/attendance/access";
import { isIsoDate, mostRecentOccurrence, shiftWeeks } from "@/lib/attendance/dates";
import { getRegister } from "@/lib/attendance/data/register";
import { getCurrentClub } from "@/lib/clubs/current";
import { DAY_META, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { permissionPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage(props: PageProps<"/courses/[id]/register">) {
  const session = await permissionPage("attendance.mark");
  const { id } = await props.params;
  const params = await props.searchParams;

  const [course, { club }] = await Promise.all([getCourse(id), getCurrentClub()]);
  if (!course) notFound();
  if (course.clubId !== club.id) {
    return (
      <WrongClub
        what={`The register for ${courseName(course)}`}
        owner={course.club}
        current={club}
      />
    );
  }

  const requested = isIsoDate(params.date) ? params.date : null;
  // A date on the wrong weekday would only ever meet the guard that refuses it,
  // so an unusable one falls back to the last time the class actually ran.
  const iso =
    requested && weekdayOf(parseDateOnly(requested)) === course.dayOfWeek && requested <= today()
      ? requested
      : mostRecentOccurrence(course.dayOfWeek);

  const { lines, taken, note } = await getRegister(id, iso);

  const mayMark =
    !course.archivedAt &&
    canMarkRegister({ session, instructorId: course.instructorId });

  const previous = shiftWeeks(iso, -1);
  const next = shiftWeeks(iso, 1);
  const canGoForward = next <= today();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/courses/${course.id}`}
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          {courseName(course)}
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatDate(parseDateOnly(iso))}
              {taken ? (
                <Tag color="green">Attendance taken</Tag>
              ) : (
                <Tag color="yellow">Attendance not taken</Tag>
              )}
            </span>
          }
          description={`${courseName(course)} · ${formatSlot(course)}${
            course.instructor ? ` · ${course.instructor.name}` : ""
          }`}
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/courses/${course.id}/register?date=${previous}`}>
                  <ChevronLeft className="size-4" />
                  Week before
                </Link>
              </Button>
              {canGoForward ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/courses/${course.id}/register?date=${next}`}>
                    Week after
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      {!mayMark ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          {course.archivedAt
            ? "This course is archived, so its registers are read-only."
            : `This is ${course.instructor?.name ?? "somebody else"}'s class, so you can read the register but not change it. An admin can reassign the course if you are covering.`}
        </p>
      ) : null}

      {note ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> {note.note}{" "}
          <span className="text-xs">— {note.byName}</span>
        </p>
      ) : null}

      {lines.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody was in this class on that day"
          hint={`Enrolments starting after ${formatDate(parseDateOnly(iso))} do not appear on it — try a later ${DAY_META[course.dayOfWeek].label}.`}
        />
      ) : (
        <RegisterForm
          courseId={course.id}
          date={iso}
          lines={lines}
          classNote={note?.note ?? null}
          readOnly={!mayMark}
        />
      )}
    </div>
  );
}
