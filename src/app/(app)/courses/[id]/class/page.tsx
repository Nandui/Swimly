import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banner } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { TakeOver } from "@/components/attendance/take-over";
import { WrongClub } from "@/components/clubs/wrong-club";
import { LessonWorkspace } from "@/components/lesson/workspace";
import { canMarkRegister, needsTakeOver } from "@/lib/attendance/access";
import {
  isIsoDate,
  mostRecentOccurrence,
  shiftWeeks,
} from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { getLesson } from "@/lib/lesson/data";
export const metadata: Metadata = { title: "Class" };
export default async function ClassPage(
  props: PageProps<"/courses/[id]/class">,
) {
  const session = await pageSession();
  if (
    (!canSee(session, "today") && !canSee(session, "courses")) ||
    !can(session, "attendance.mark")
  )
    notFound();
  const { id } = await props.params;
  const params = await props.searchParams;
  const [course, { club }] = await Promise.all([
    getCourse(id),
    getCurrentClub(),
  ]);
  if (!course) notFound();
  if (course.clubId !== club.id)
    return (
      <WrongClub
        what={`The class ${courseName(course)}`}
        owner={course.club}
        current={club}
      />
    );
  const requested = isIsoDate(params.date) ? params.date : null;
  const iso =
    requested &&
    weekdayOf(parseDateOnly(requested)) === course.dayOfWeek &&
    requested <= today()
      ? requested
      : mostRecentOccurrence(course.dayOfWeek);
  const [register, cover, progress, lesson] = await Promise.all([
    getRegister(id, iso),
    getClassCover(id, iso),
    getClassProgress(id),
    getLesson(id, iso),
  ]);
  if (!progress || !lesson) notFound();
  const access = {
    session,
    instructorId: course.instructorId,
    coverById: cover?.coverById,
  };
  const mayMark = !course.archivedAt && canMarkRegister(access);
  const mayAssess = mayMark && can(session, "progression.assess");
  const askTakeOver = !course.archivedAt && needsTakeOver(access);
  const roster = register.lines.filter(
    (line) => line.studentId in lesson.saved.data.attendance,
  );
  return (
    <div className="flex flex-col gap-6">
      <BackLink
        href={canSee(session, "today") ? "/today" : `/courses/${id}`}
        current={courseName(course)}
      >
        {canSee(session, "today") ? "Today" : "Class details"}
      </BackLink>
      <PageHeader
        title={courseName(course)}
        description={`${formatSlot(course)} · ${formatDate(parseDateOnly(iso))}${cover ? ` · ${coverLabel(cover)}` : course.instructor ? ` · ${course.instructor.name}` : ""}`}
        actions={
          <>
            <Button
              label="Week before"
              variant="secondary"
              href={`/courses/${id}/class?date=${shiftWeeks(iso, -1)}`}
              icon={<AppIcon name="chevronLeft" size="sm" />}
            />
            {shiftWeeks(iso, 1) <= today() ? (
              <Button
                label="Week after"
                variant="secondary"
                href={`/courses/${id}/class?date=${shiftWeeks(iso, 1)}`}
                endContent={<AppIcon name="chevronRight" size="sm" />}
              />
            ) : null}
            {canSee(session, "courses") ? (
              <Button
                label="Class details"
                variant="ghost"
                href={`/courses/${id}`}
              />
            ) : null}
          </>
        }
      />
      {course.archivedAt ? (
        <Banner
          status="info"
          title="This class is archived and can only be viewed."
        />
      ) : askTakeOver ? (
        <TakeOver
          courseId={id}
          date={iso}
          classLabel={courseName(course)}
          dateLabel={formatDate(parseDateOnly(iso))}
          instructorName={course.instructor?.name ?? null}
          mayMarkAnyway={mayMark}
          autoOpen={false}
        />
      ) : !mayMark ? (
        <Banner
          status="info"
          title="You can read this class but cannot change it."
        />
      ) : null}
      <LessonWorkspace
        key={`${id}:${iso}:${mayMark}:${mayAssess}:${roster
          .map((line) => line.studentId)
          .sort()
          .join(",")}`}
        courseId={id}
        date={iso}
        draftKey={`swimly:lesson:v1:${session.user.id}:${club.id}:${id}:${iso}`}
        initial={lesson.saved}
        lines={roster}
        skills={progress.course.level.competencies}
        levelId={course.levelId}
        levelName={course.level.name}
        canMark={mayMark}
        canAssess={mayAssess}
        canComplete={mayAssess && can(session, "progression.complete")}
        canOverride={can(session, "progression.override")}
        completedIds={progress.swimmers
          .filter((swimmer) => swimmer.completedOn)
          .map((swimmer) => swimmer.student.id)}
        initialView={
          params.step === "competencies" ? "competencies" : "attendance"
        }
      />
    </div>
  );
}
