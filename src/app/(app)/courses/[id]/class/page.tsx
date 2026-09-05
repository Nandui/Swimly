import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/attendance/register-form";
import { TakeOver } from "@/components/attendance/take-over";
import { WrongClub } from "@/components/clubs/wrong-club";
import { ConfirmLevel } from "@/components/progression/assessment";
import { DeckChecklist } from "@/components/progression/deck-checklist";
import { canMarkRegister, needsTakeOver } from "@/lib/attendance/access";
import { isIsoDate, mostRecentOccurrence } from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { DAY_META, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { fullName } from "@/lib/students/constants";

export const metadata: Metadata = { title: "Class" };

type Step = "attendance" | "competencies";

/** The class, run from the deck: one button on Today opens it, attendance
 *  is step one and the competencies are step two. Saving the attendance
 *  moves on; finishing the checklist goes back to Today.
 *
 *  Step two marks one competency at a time across the whole class, the
 *  way a lesson happens. The register page and the assessment page still
 *  exist for the desk — for a register weeks back, for one swimmer's whole
 *  checklist, and for moving a swimmer up. */
export default async function ClassPage(props: PageProps<"/courses/[id]/class">) {
  const session = await screenPage("today", "attendance.mark");
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

  const [{ lines, taken, note }, cover, progress] = await Promise.all([
    getRegister(id, iso),
    getClassCover(id, iso),
    getClassProgress(id),
  ]);
  if (!progress) notFound();

  const access = { session, instructorId: course.instructorId, coverById: cover?.coverById };
  const mayMark = !course.archivedAt && canMarkRegister(access);
  // Marking competencies is its own permission; being the one at the pool
  // is necessary but not enough.
  const mayAssess = mayMark && can(session, "progression.assess");
  const mayComplete = mayAssess && can(session, "progression.complete");
  const askTakeOver = !course.archivedAt && needsTakeOver(access);
  const admin = can(session, "progression.override");

  const stepHref = (next: Step) =>
    `/courses/${course.id}/class?date=${iso}${next === "competencies" ? "&step=competencies" : ""}`;

  const readyToComplete = progress.swimmers.filter((s) => s.eligible && !s.completedOn);

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
              {/* The desk's page for this class, for roles that have it.
                  Today itself never leads off the deck; this is the one
                  door. */}
              {canSee(session, "courses") ? (
                <Link
                  href={`/courses/${course.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {courseName(course)}
                </Link>
              ) : (
                courseName(course)
              )}
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
          This class is archived, so it is read-only.
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
      ) : step === "competencies" && !mayAssess ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          You can read these marks but not change them.
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
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="max-w-prose text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {progress.swimmers.length}
              </span>{" "}
              {progress.swimmers.length === 1 ? "swimmer" : "swimmers"} working through{" "}
              <span className="font-medium text-foreground tabular-nums">
                {progress.course.level.competencies.length}
              </span>{" "}
              {progress.course.level.competencies.length === 1 ? "competency" : "competencies"}{" "}
              in {progress.course.level.name}.
            </p>
            {canSee(session, "courses") ? (
              <Link
                href={`/courses/${course.id}/assess`}
                className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                One swimmer at a time
              </Link>
            ) : null}
          </div>

          {readyToComplete.length > 0 ? (
            <section className="space-y-2" aria-label="Ready to complete">
              <h2 className="text-sm font-semibold text-foreground">
                Ready to complete {progress.course.level.name}
                <span className="sr-only">,</span>{" "}
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {readyToComplete.length}
                </span>
              </h2>
              <ul className="overflow-hidden rounded-md border">
                {readyToComplete.map((swimmer) => (
                  <li
                    key={swimmer.student.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 last:border-0"
                  >
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {fullName(swimmer.student)}
                      <Tag color="green">
                        {swimmer.achieved} of {swimmer.total}
                      </Tag>
                    </span>
                    {mayComplete ? (
                      <ConfirmLevel
                        studentId={swimmer.student.id}
                        levelId={progress.course.levelId}
                        studentName={fullName(swimmer.student)}
                        levelName={progress.course.level.name}
                        achieved={swimmer.achieved}
                        total={swimmer.total}
                        eligible={swimmer.eligible}
                        admin={admin}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <DeckChecklist
            courseId={course.id}
            date={iso}
            levelId={progress.course.levelId}
            competencies={progress.course.level.competencies}
            swimmers={progress.swimmers.map((swimmer) => ({
              studentId: swimmer.student.id,
              name: fullName(swimmer.student),
              offLevel: swimmer.offLevel,
              completed: Boolean(swimmer.completedOn),
              marks: Object.fromEntries(swimmer.competencies.map((c) => [c.id, c.status])),
            }))}
            // Who was in the water, once attendance is taken; before that,
            // nobody is ruled out.
            attendance={
              taken
                ? Object.fromEntries(lines.map((line) => [line.studentId, line.status]))
                : null
            }
            readOnly={!mayAssess}
            doneHref="/today"
          />
        </>
      )}
    </div>
  );
}
