import { COMPETENCY_STATUS_META } from "@/lib/progression/constants";
import { ATTENDANCE_RECORD_META } from "@/lib/attendance/constants";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
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
import { canMarkRegister, needsTakeOver } from "@/lib/attendance/access";
import { isIsoDate, mostRecentOccurrence, shiftWeeks } from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { DAY_META, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { fullName } from "@/lib/students/constants";
import { AppIcon } from "@/components/ui-kit/app-icon";

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
  // Reached from Today by the deck and from Classes by the desk, so either
  // screen opens it; taking attendance is still the permission it needs.
  const session = await pageSession();
  if (!canSee(session, "today") && !canSee(session, "courses")) notFound();
  if (!can(session, "attendance.mark")) notFound();
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

  const [{ lines, taken, note, revision }, cover, progress] = await Promise.all([
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
  const competencies = progress.course.level.competencies.length;

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        {/* Back to wherever this person's deck is: Today for an instructor,
            the class's own page for a desk role without Today. */}
        <BackLink
          href={canSee(session, "today") ? "/today" : `/courses/${course.id}`}
          current={canSee(session, "today") ? courseName(course) : "Class"}
        >
          {canSee(session, "today") ? "Today" : courseName(course)}
        </BackLink>
        <PageHeader
          actions={
            step === "attendance" ? (
              <>
                <Button
                  label="Week before"
                  variant="secondary"
                  href={`/courses/${course.id}/class?date=${shiftWeeks(iso, -1)}`}
                  icon={<AppIcon name="chevronLeft" size="sm" />}
                />
                {shiftWeeks(iso, 1) <= today() ? (
                  <Button
                    label="Week after"
                    variant="secondary"
                    href={`/courses/${course.id}/class?date=${shiftWeeks(iso, 1)}`}
                    endContent={<AppIcon name="chevronRight" size="sm" />}
                  />
                ) : null}
              </>
            ) : null
          }
          title={
            <HStack gap={2} vAlign="center" wrap="wrap">
              {/* The desk's page for this class, for roles that have it.
                  Today itself never leads off the deck; this is the one
                  door. */}
              {canSee(session, "courses") ? (
                <Link href={`/courses/${course.id}`} color="primary">
                  {courseName(course)}
                </Link>
              ) : (
                courseName(course)
              )}
              {taken ? <Tag color={ATTENDANCE_RECORD_META.taken.color}>{ATTENDANCE_RECORD_META.taken.label}</Tag> : null}
              {cover ? <Tag color={ATTENDANCE_RECORD_META.covered.color}>{ATTENDANCE_RECORD_META.covered.label}</Tag> : null}
            </HStack>
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
      </VStack>

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
        <Banner status="info" title="This class is archived, so it is read-only." collapsible={false} />
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
        <Banner status="info" title="You can read this class but not change it." collapsible={false} />
      ) : step === "competencies" && !mayAssess ? (
        <Banner status="info" title="You can read these marks but not change them." collapsible={false} />
      ) : null}

      {step === "attendance" ? (
        <>
          {note ? (
            <Lead>
              <Text weight="medium" color="primary">
                Note:
              </Text>{" "}
              {note.note} <Text type="supporting">— {note.byName}</Text>
            </Lead>
          ) : null}

          {lines.length === 0 ? (
            <EmptyState
              icon="users"
              title="Nobody was in this class on that day"
              hint={`Enrolments starting after ${formatDate(parseDateOnly(iso))} do not appear on it — try a later ${DAY_META[course.dayOfWeek].label}.`}
              action={
                <Button
                  label="Competencies"
                  variant="secondary"
                  href={stepHref("competencies")}
                  endContent={<AppIcon name="arrowRight" size="sm" />}
                />
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
            <HStack hAlign="end">
              <Button
                label="Competencies"
                variant="secondary"
                size="lg"
                href={stepHref("competencies")}
                endContent={<AppIcon name="arrowRight" size="sm" />}
              />
            </HStack>
          ) : null}
        </>
      ) : (
        <>
          <Lead>
            <Num>{progress.swimmers.length}</Num>{" "}
            {progress.swimmers.length === 1 ? "swimmer" : "swimmers"} working through{" "}
            <Num>{competencies}</Num> {competencies === 1 ? "competency" : "competencies"} in{" "}
            {progress.course.level.name}.
          </Lead>

          {readyToComplete.length > 0 ? (
            <VStack gap={2} as="section" aria-label="Ready to complete">
              <Heading level={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  Ready to complete {progress.course.level.name}
                  <VisuallyHidden>,</VisuallyHidden>
                  <Text color="secondary" weight="normal" hasTabularNumbers>
                    {readyToComplete.length}
                  </Text>
                </HStack>
              </Heading>
              <List hasDividers>
                {readyToComplete.map((swimmer) => (
                  <Item
                    key={swimmer.student.id}
                    as="li"
                    label={
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="medium">{fullName(swimmer.student)}</Text>
                        <Tag color={COMPETENCY_STATUS_META.ACHIEVED.color}>
                          {swimmer.achieved} of {swimmer.total}
                        </Tag>
                      </HStack>
                    }
                    endContent={
                      mayComplete ? (
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
                      ) : undefined
                    }
                  />
                ))}
              </List>
            </VStack>
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
    </VStack>
  );
}
