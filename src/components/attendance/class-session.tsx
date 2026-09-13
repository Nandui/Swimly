import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import { Notice } from "@/components/ui-kit/notice";
import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import { COMPETENCY_STATUS_META } from "@/lib/progression/constants";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { RegisterForm } from "@/components/attendance/register-form";
import { TakeOver } from "@/components/attendance/take-over";
import { WrongClub } from "@/components/clubs/wrong-club";
import { ConfirmLevel } from "@/components/progression/assessment";
import { DeckChecklist } from "@/components/progression/deck-checklist";
import {
  canMarkRegister,
  canTeachClass,
  needsTakeOver,
} from "@/lib/attendance/access";
import {
  isIsoDate,
  mostRecentOccurrence,
  shiftWeeks,
} from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { DAY_META, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { classPage } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { fullName } from "@/lib/students/constants";
import { AppIcon } from "@/components/ui-kit/app-icon";
import {
  classReturnDestination,
  instructorClassHref,
  type ClassWorkspace,
  type ClassQuery,
} from "@/lib/attendance/navigation";

type Step = "attendance" | "competencies";

/** The class, run from the deck: one button on Instructor opens it, attendance
 *  is step one and the competencies are step two. Saving the attendance
 *  moves on; finishing the checklist returns to the page that opened it.
 *
 *  Step two marks one competency at a time across the whole class, the
 *  way a lesson happens. Both workspaces reuse these forms, while their
 *  screen guards, navigation and return destinations stay independent. */
export async function ClassSession({
  id,
  params,
  workspace,
}: {
  id: string;
  params: ClassQuery;
  workspace: ClassWorkspace;
}) {
  // The route chooses the workspace; query parameters cannot change access.
  const session = await classPage(workspace);
  const step: Step =
    params.step === "competencies" ? "competencies" : "attendance";

  const [course, { club }] = await Promise.all([
    getCourse(id),
    getCurrentClub(),
  ]);
  if (!course) notFound();
  const returnTo = classReturnDestination(
    {
      instructor: canSee(session, "instructor"),
      calendar: canSee(session, "calendar"),
      courses: canSee(session, "courses"),
    },
    params.from,
    course.id,
    workspace,
    params,
  );
  if (!returnTo) notFound();
  const sourceQuery = returnTo.source ? `&from=${returnTo.source}` : "";
  if (course.clubId !== club.id) {
    return (
      <WrongClub
        what={`The class ${courseName(course)}`}
        owner={course.club}
        current={club}
      />
    );
  }

  // The date the class ran: today when it runs today, otherwise the last
  // time it did. A date on the wrong weekday falls back the same way.
  const requested = isIsoDate(params.date) ? params.date : null;
  const iso =
    requested &&
    weekdayOf(parseDateOnly(requested)) === course.dayOfWeek &&
    requested <= today()
      ? requested
      : mostRecentOccurrence(course.dayOfWeek);

  const [{ lines, taken, note, revision }, cover, progress] = await Promise.all(
    [getRegister(id, iso), getClassCover(id, iso), getClassProgress(id)],
  );
  if (!progress) notFound();

  const access = {
    session,
    instructorId: course.instructorId,
    coverById: cover?.coverById,
  };
  const mayMark =
    !course.archivedAt &&
    (workspace === "instructor"
      ? canTeachClass(access)
      : canMarkRegister(access));
  // Marking competencies is its own permission; being the one at the pool
  // is necessary but not enough.
  const mayAssess = mayMark && can(session, "progression.assess");
  const mayComplete = mayAssess && can(session, "progression.complete");
  const askTakeOver = !course.archivedAt && needsTakeOver(access);
  const admin = can(session, "progression.override");

  const stepHref = (next: Step, date = iso) =>
    workspace === "instructor"
      ? instructorClassHref(course.id, { ...params, date, step: next })
      : `/courses/${encodeURIComponent(course.id)}/class?date=${date}${sourceQuery}${next === "competencies" ? "&step=competencies" : ""}`;

  const readyToComplete = progress.swimmers.filter(
    (s) => s.eligible && !s.completedOn,
  );
  const competencies = progress.course.level.competencies.length;

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <div className="min-w-0 flex flex-col gap-2">
        <BackLink
          href={returnTo.href}
          current={returnTo.source ? courseName(course) : "Class"}
        >
          {returnTo.source ? returnTo.label : courseName(course)}
        </BackLink>
        <PageHeader
          actions={
            step === "attendance" ? (
              <>
                <Button variant="outline" asChild={true}>
                  <UiLink href={stepHref("attendance", shiftWeeks(iso, -1))}>
                    {<AppIcon name="chevronLeft" size="sm" />}
                    {"Week before"}
                  </UiLink>
                </Button>
                {shiftWeeks(iso, 1) <= today() ? (
                  <Button variant="outline" asChild={true}>
                    <UiLink href={stepHref("attendance", shiftWeeks(iso, 1))}>
                      {"Week after"}
                      {<AppIcon name="chevronRight" size="sm" />}
                    </UiLink>
                  </Button>
                ) : null}
              </>
            ) : null
          }
          title={
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              {workspace === "desk" && canSee(session, "courses") ? (
                <UiLink
                  href={`/courses/${course.id}`}
                  className={
                    "text-ui-foreground underline-offset-4 hover:underline"
                  }
                >
                  {courseName(course)}
                </UiLink>
              ) : (
                courseName(course)
              )}
              {taken ? (
                <Tag color={ATTENDANCE_RECORD_META.taken.color}>
                  {ATTENDANCE_RECORD_META.taken.label}
                </Tag>
              ) : null}
              {cover && cover.coverById !== cover.instructorId ? (
                <Tag color={ATTENDANCE_RECORD_META.covered.color}>
                  {ATTENDANCE_RECORD_META.covered.label}
                </Tag>
              ) : null}
            </div>
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
        <Notice
          title="This class is archived, so it is read-only."
          tone="info"
        ></Notice>
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
        <Notice
          title="You can read this class but not change it."
          tone="info"
        ></Notice>
      ) : step === "competencies" && !mayAssess ? (
        <Notice
          title="You can read these marks but not change them."
          tone="info"
        ></Notice>
      ) : null}

      {step === "attendance" ? (
        <>
          {note ? (
            <Lead>
              <span className="text-sm text-ui-foreground font-medium">
                Note:
              </span>{" "}
              {note.note}{" "}
              <span className="text-sm text-ui-muted-foreground">
                — {note.byName}
              </span>
            </Lead>
          ) : null}

          {lines.length === 0 ? (
            <EmptyState
              icon="users"
              title="Nobody was in this class on that day"
              hint={`Enrolments starting after ${formatDate(parseDateOnly(iso))} do not appear on it — try a later ${DAY_META[course.dayOfWeek].label}.`}
              action={
                <Button variant="outline" asChild={true}>
                  <UiLink href={stepHref("competencies")}>
                    {"Competencies"}
                    {<AppIcon name="arrowRight" size="sm" />}
                  </UiLink>
                </Button>
              }
            />
          ) : (
            <RegisterForm
              revision={revision}
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
            <div className="min-w-0 flex gap-2 items-center justify-end">
              <Button variant="outline" size="lg" asChild={true}>
                <UiLink href={stepHref("competencies")}>
                  {"Competencies"}
                  {<AppIcon name="arrowRight" size="sm" />}
                </UiLink>
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Lead>
            <Num>{progress.swimmers.length}</Num>{" "}
            {progress.swimmers.length === 1 ? "swimmer" : "swimmers"} working
            through <Num>{competencies}</Num>{" "}
            {competencies === 1 ? "competency" : "competencies"} in{" "}
            {progress.course.level.name}.
          </Lead>

          {readyToComplete.length > 0 ? (
            <section
              aria-label="Ready to complete"
              className="min-w-0 flex flex-col gap-2"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  Ready to complete {progress.course.level.name}
                  <span className="sr-only">,</span>
                  <span
                    className={
                      "text-sm text-ui-muted-foreground font-normal tabular-nums"
                    }
                  >
                    {readyToComplete.length}
                  </span>
                </div>
              </h2>
              <ItemGroup className="divide-y divide-ui-border">
                {readyToComplete.map((swimmer) => (
                  <Item
                    key={swimmer.student.id}
                    role="listitem"
                    className="[overflow-wrap:anywhere]"
                  >
                    <ItemContent className="min-w-0">
                      <div className="text-sm font-medium">
                        {
                          <div
                            className={
                              "min-w-0 flex gap-2 items-center flex-wrap"
                            }
                          >
                            <span
                              className={
                                "text-sm text-ui-foreground font-medium"
                              }
                            >
                              {fullName(swimmer.student)}
                            </span>
                            <Tag color={COMPETENCY_STATUS_META.ACHIEVED.color}>
                              {swimmer.achieved} of {swimmer.total}
                            </Tag>
                          </div>
                        }
                      </div>
                    </ItemContent>
                    <ItemActions className="flex-wrap">
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
                      ) : undefined}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
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
              marks: Object.fromEntries(
                swimmer.competencies.map((c) => [c.id, c.status]),
              ),
            }))}
            // Who was in the water, once attendance is taken; before that,
            // nobody is ruled out.
            attendance={
              taken
                ? Object.fromEntries(
                    lines.map((line) => [line.studentId, line.status]),
                  )
                : null
            }
            readOnly={!mayAssess}
            doneHref={returnTo.href}
            doneLabel={returnTo.label}
          />
        </>
      )}
    </div>
  );
}
