import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { CompetencyChecklist, ConfirmLevel } from "@/components/progression/assessment";
import { MoveUpToLevel, type MoveTarget } from "@/components/progression/move-up";
import { canMarkRegister } from "@/lib/attendance/access";
import { isAdmin } from "@/lib/authz";
import { courseLabel, courseName, formatSlot } from "@/lib/courses/constants";
import { getCourse, getCourses } from "@/lib/courses/data/courses";
import { formatDate } from "@/lib/format";
import { managePage } from "@/lib/page-guards";
import { getClassProgress, type ClassSwimmer } from "@/lib/progression/data/progress";
import { nextLevel } from "@/lib/progression/rules";
import { fullName } from "@/lib/students/constants";

export const metadata: Metadata = { title: "Assess" };

export default async function AssessPage(props: PageProps<"/courses/[id]/assess">) {
  const session = await managePage();
  const { id } = await props.params;

  const [course, progress, courses] = await Promise.all([
    getCourse(id),
    getClassProgress(id),
    getCourses(),
  ]);
  if (!course || !progress) notFound();

  // What "up" means from this class, and the classes that teach it.
  const up = nextLevel(progress.course.levelId, progress.orderedLevels);

  const admin = isAdmin(session.user.role);
  const mayAssess =
    !course.archivedAt &&
    canMarkRegister({
      role: session.user.role,
      userId: session.user.id,
      instructorId: course.instructorId,
    });

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
          description={`${courseName(course)} · ${formatSlot(course)}`}
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

      {!mayAssess ? (
        <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          {course.archivedAt
            ? "This course is archived, so its assessments are read-only."
            : `This is ${course.instructor?.name ?? "somebody else"}'s class — you can read it but not sign anything off.`}
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

/** One swimmer per disclosure. A class of twelve at eight competencies each is
 *  ninety-six rows if everything is open at once, which is not a thing anyone
 *  can work down at the poolside. */
function SwimmerBlock({
  swimmer,
  levelId,
  levelName,
  classLabel,
  nextUp,
  courses,
  mayAssess,
  admin,
}: {
  swimmer: ClassSwimmer;
  levelId: string;
  levelName: string;
  classLabel: string;
  nextUp: { id: string; name: string } | null;
  courses: MoveTarget[];
  mayAssess: boolean;
  admin: boolean;
}) {
  const name = fullName(swimmer.student);
  const done = Boolean(swimmer.completedOn);

  return (
    <details className="overflow-hidden rounded-md border" open={swimmer.eligible && !done}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-sidebar px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          <Link
            href={`/students/${swimmer.student.id}`}
            className="underline-offset-2 hover:underline"
          >
            {name}
          </Link>
          {swimmer.offLevel ? (
            <Tag color="purple" className="ml-2">
              Placed at another level
            </Tag>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          {done ? (
            <Tag color="blue">Completed {formatDate(swimmer.completedOn!)}</Tag>
          ) : (
            <Tag color={swimmer.eligible ? "green" : "yellow"}>
              {swimmer.achieved} of {swimmer.total}
            </Tag>
          )}
        </span>
      </summary>

      <div className="space-y-3 p-3">
        <CompetencyChecklist
          studentId={swimmer.student.id}
          levelId={levelId}
          studentName={name}
          competencies={swimmer.competencies}
          readOnly={!mayAssess}
        />
        {mayAssess ? (
          <div className="flex flex-wrap justify-end gap-2">
            {done ? null : (
              <ConfirmLevel
                studentId={swimmer.student.id}
                levelId={levelId}
                studentName={name}
                levelName={levelName}
                achieved={swimmer.achieved}
                total={swimmer.total}
                eligible={swimmer.eligible}
                admin={admin}
              />
            )}
            {/* Once the level is signed off and confirmed, the next thing
                anyone wants is to put them in a class for the rung above. */}
            {done && nextUp ? (
              <MoveUpToLevel
                studentId={swimmer.student.id}
                studentName={name}
                fromEnrolmentId={swimmer.enrolmentId}
                fromClassLabel={classLabel}
                nextLevelId={nextUp.id}
                nextLevelName={nextUp.name}
                courses={courses}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
