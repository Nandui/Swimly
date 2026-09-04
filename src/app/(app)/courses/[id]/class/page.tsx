import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/attendance/register-form";
import { TakeOver } from "@/components/attendance/take-over";
import { WrongClub } from "@/components/clubs/wrong-club";
import { SwimmerBlock } from "@/components/progression/swimmer-block";
import { canMarkRegister, needsTakeOver } from "@/lib/attendance/access";
import { isIsoDate, mostRecentOccurrence } from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { DAY_META, courseLabel, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse, getCourses } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { permissionPage } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { nextLevel } from "@/lib/progression/rules";

export const metadata: Metadata = { title: "Class" };

type Step = "attendance" | "competencies";

/** The class, run from the deck: one button on Today opens it, attendance
 *  is step one and the competencies are step two. Saving the attendance
 *  moves on; finishing the checklist goes back to Today.
 *
 *  The register page and the assessment page still exist for the desk —
 *  for a register weeks back, or a checklist outside class time. This page
 *  is the same two things in the order the class happens in. */
export default async function ClassPage(props: PageProps<"/courses/[id]/class">) {
  const session = await permissionPage("attendance.mark");
  const { id } = await props.params;
  const params = await props.searchParams;
  const step: Step = params.step === "competencies" ? "competencies" : "attendance";

  const [course, { club }] = await Promise.all([getCourse(id), getCurrentClub()]);
  if (!course) notFound();
  if (course.clubId !== club.id) {
    return (
      <WrongClub what={`The class ${courseName(course)}`} owner={course.club} current={club} />
    );
  }

  // The date the class ran: today when it runs today, otherwise the last
  // time it did. A date on the wrong weekday falls back the same way.
  const requested = isIsoDate(params.date) ? params.date : null;
  const iso =
    requested && weekdayOf(parseDateOnly(requested)) === course.dayOfWeek && requested <= today()
      ? requested
      : mostRecentOccurrence(course.dayOfWeek);

  const [{ lines, taken, note }, cover, progress, courses] = await Promise.all([
    getRegister(id, iso),
    getClassCover(id, iso),
    getClassProgress(id),
    getCourses(),
  ]);
  if (!progress) notFound();

  const access = { session, instructorId: course.instructorId, coverById: cover?.coverById };
  const mayMark = !course.archivedAt && canMarkRegister(access);
  const askTakeOver = !course.archivedAt && needsTakeOver(access);
  const admin = can(session, "progression.override");
  const up = nextLevel(progress.course.levelId, progress.orderedLevels);

  const stepHref = (next: Step) =>
    `/courses/${course.id}/class?date=${iso}${next === "competencies" ? "&step=competencies" : ""}`;

  const ready = progress.swimmers.filter((s) => s.eligible && !s.completedOn).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/today"
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Today
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {courseName(course)}
              {taken ? <Tag color="green">Attendance taken</Tag> : null}
              {cover ? <Tag color="purple">Covered</Tag> : null}
            </span>
          }
          description={
            `${formatSlot(course)} · ${formatDate(parseDateOnly(iso))}` +
            (cover
              ? ` · ${coverLabel(cover)}`
              : course.instructor
                ? ` · ${course.instructor.name}`
                : "")
          }
        />
      </div>

      <TabStrip
        ariaLabel="Steps"
        items={[
          {
            key: "attendance",
            href: stepHref("attendance"),
            label: "1. Attendance",
            active: step === "attendance",
          },
          {
            key: "competencies",
            href: stepHref("competencies"),
            label: "2. Competencies",
            active: step === "competencies",
          },
        ]}
      />

      {course.archivedAt ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          This course is archived, so it is read-only.
        </p>
      ) : askTakeOver ? (
        <TakeOver
          courseId={course.id}
          date={iso}
          classLabel={courseName(course)}
          dateLabel={formatDate(parseDateOnly(iso))}
          instructorName={course.instructor?.name ?? null}
          mayMarkAnyway={mayMark}
          autoOpen
        />
      ) : !mayMark ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          You can read this class but not change it.
        </p>
      ) : null}

      {step === "attendance" ? (
        <>
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
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={stepHref("competencies")}>
                    Competencies
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
            />
          ) : (
            <RegisterForm
              courseId={course.id}
              date={iso}
              lines={lines}
              classNote={note?.note ?? null}
              readOnly={!mayMark}
              continueHref={mayMark ? stepHref("competencies") : undefined}
            />
          )}

          {/* Somebody who may only read still needs the way to step two. */}
          {!mayMark && lines.length > 0 ? (
            <div className="flex justify-end">
              <Button asChild variant="outline" size="lg">
                <Link href={stepHref("competencies")}>
                  Competencies
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="max-w-prose text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {progress.swimmers.length}
            </span>{" "}
            {progress.swimmers.length === 1 ? "swimmer" : "swimmers"} working through{" "}
            <span className="font-medium text-foreground tabular-nums">
              {progress.course.level.competencies.length}
            </span>{" "}
            {progress.course.level.competencies.length === 1 ? "competency" : "competencies"}.
            {ready > 0 ? (
              <>
                {" "}
                <span className="font-medium text-(--tag-green-fg) tabular-nums">{ready}</span>{" "}
                {ready === 1 ? "is" : "are"} ready to move up.
              </>
            ) : null}
          </p>

          {progress.swimmers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nobody in this class yet"
              hint="Enrol a swimmer and their checklist appears here."
            />
          ) : (
            <div className="space-y-3">
              {progress.swimmers.map((swimmer) => (
                <SwimmerBlock
                  key={swimmer.student.id}
                  swimmer={swimmer}
                  levelId={progress.course.levelId}
                  levelName={progress.course.level.name}
                  classLabel={courseLabel(course)}
                  nextUp={up}
                  courses={courses}
                  mayAssess={mayMark}
                  admin={admin}
                />
              ))}
            </div>
          )}

          {/* Each checklist saves itself, so finishing is just going back. */}
          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8">
            <Button asChild variant="outline" size="lg">
              <Link href={stepHref("attendance")}>
                <ChevronLeft className="size-4" />
                Attendance
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/today">
                <Check className="size-4" />
                Done, back to Today
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
