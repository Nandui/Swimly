import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TakeOver } from "@/components/attendance/take-over";
import { WrongClub } from "@/components/clubs/wrong-club";
import { SwimmerBlock } from "@/components/progression/swimmer-block";
import { canMarkRegister, needsTakeOver } from "@/lib/attendance/access";
import { mostRecentOccurrence } from "@/lib/attendance/dates";
import { coverLabel, getClassCover } from "@/lib/attendance/data/cover";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { courseLabel, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse, getCourses } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly } from "@/lib/format";
import { permissionPage } from "@/lib/page-guards";
import { getClassProgress } from "@/lib/progression/data/progress";
import { nextLevel } from "@/lib/progression/rules";

export const metadata: Metadata = { title: "Assess" };

export default async function AssessPage(props: PageProps<"/courses/[id]/assess">) {
  const session = await permissionPage("progression.assess");
  const { id } = await props.params;

  const [course, progress, courses, { club }] = await Promise.all([
    getCourse(id),
    getClassProgress(id),
    getCourses(),
    getCurrentClub(),
  ]);
  if (!course || !progress) notFound();
  if (course.clubId !== club.id) {
    return (
      <WrongClub what={`The class ${courseName(course)}`} owner={course.club} current={club} />
    );
  }

  // What "up" means from this class, and the classes that teach it.
  const up = nextLevel(progress.course.levelId, progress.orderedLevels);

  // The checklist belongs to whoever is taking the class today — the day it
  // last ran, which is today when it runs today. A cover for that day makes
  // it theirs, the same as the register.
  const iso = mostRecentOccurrence(course.dayOfWeek);
  const cover = await getClassCover(course.id, iso);
  const access = { session, instructorId: course.instructorId, coverById: cover?.coverById };

  const admin = can(session, "progression.override");
  const mayAssess = !course.archivedAt && canMarkRegister(access);
  const askTakeOver = !course.archivedAt && needsTakeOver(access);

  const ready = progress.swimmers.filter(
    (swimmer) => swimmer.eligible && !swimmer.completedOn
  ).length;

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
          title={`Assessing ${progress.course.level.name}`}
          description={
            `${courseName(course)} · ${formatSlot(course)}` +
            (cover ? ` · ${coverLabel(cover)} on ${formatDate(parseDateOnly(iso))}` : "")
          }
        />
      </div>

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

      {course.archivedAt ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          This course is archived, so its assessments are read-only.
        </p>
      ) : askTakeOver ? (
        <TakeOver
          courseId={course.id}
          date={iso}
          classLabel={courseName(course)}
          dateLabel={formatDate(parseDateOnly(iso))}
          instructorName={course.instructor?.name ?? null}
          mayMarkAnyway={mayAssess}
          autoOpen
        />
      ) : !mayAssess ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          You can read this checklist but not sign anything off.
        </p>
      ) : null}

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
              mayAssess={mayAssess}
              admin={admin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
