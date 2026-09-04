import Link from "next/link";
import { Tag } from "@/components/ui-kit/tag";
import { CompetencyChecklist, ConfirmLevel } from "@/components/progression/assessment";
import { MoveUpToLevel, type MoveTarget } from "@/components/progression/move-up";
import { formatDate } from "@/lib/format";
import type { ClassSwimmer } from "@/lib/progression/data/progress";
import { fullName } from "@/lib/students/constants";

/** One swimmer per disclosure. A class of twelve at eight competencies each is
 *  ninety-six rows if everything is open at once, which is not a thing anyone
 *  can work down at the poolside. Shared by the class's assessment page and
 *  the second step of the deck's class flow. */
export function SwimmerBlock({
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
