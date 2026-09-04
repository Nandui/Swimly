import { Tag } from "@/components/ui-kit/tag";
import {
  CompetencyChecklist,
  CompletionTag,
  ConfirmLevel,
  RevokeCompletion,
  assessedLine,
} from "@/components/progression/assessment";
import { MoveUpToLevel, type MoveTarget } from "@/components/progression/move-up";
import { formatDate } from "@/lib/format";
import { nextLevel } from "@/lib/progression/rules";
import { COMPETENCY_STATUS_META } from "@/lib/progression/constants";
import type { LevelProgress, ProgrammeProgress } from "@/lib/progression/data/progress";

/** A swimmer's standing, one section per programme.
 *
 *  The current level opens as a working checklist; the levels behind it
 *  collapse to a line each, and the ones ahead sit muted. That is the
 *  Collapse-Not-Scroll rule applied down the page rather than across it — a
 *  full curriculum is sixty-odd rows, and only one rung is live at a time. */
export function ProgressSection({
  programmes,
  studentId,
  studentName,
  manage,
  admin,
  courses = [],
  openPlaceByLevel = {},
}: {
  programmes: ProgrammeProgress[];
  studentId: string;
  studentName: string;
  manage: boolean;
  admin: boolean;
  /** Classes they could be moved into. The pages already load this. */
  courses?: MoveTarget[];
  /** Their open place at each level, so a move up closes the right one. */
  openPlaceByLevel?: Record<string, { id: string; label: string }>;
}) {
  if (programmes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to show yet — progress starts once they are enrolled in a class.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {programmes.map((programme) => {
        const current = programme.levels.find((level) => level.isCurrent) ?? null;
        const done = programme.levels.filter((level) => level.completedOn).length;

        return (
          <section key={programme.programmeId} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {programme.programmeName}
              {programme.graduated ? (
                <Tag color="blue" className="ml-2">
                  Graduated
                </Tag>
              ) : null}
            </h3>

            <p className="max-w-prose text-sm text-muted-foreground">
              {programme.graduated ? (
                <>
                  Every level finished — all{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {programme.levels.length}
                  </span>{" "}
                  of them.
                </>
              ) : current?.completedOn ? (
                <>
                  Finished <span className="font-medium text-foreground">{current.name}</span> on{" "}
                  {formatDate(current.completedOn)}
                  {nextUp(programme, current) ? (
                    <>
                      {" "}
                      — ready for{" "}
                      <span className="font-medium text-foreground">
                        {nextUp(programme, current)!.name}
                      </span>
                      , once they are in a class for it.
                    </>
                  ) : (
                    <>, the last level in the programme.</>
                  )}
                </>
              ) : current ? (
                <>
                  At <span className="font-medium text-foreground">{current.name}</span>, level{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {programme.levels.findIndex((level) => level.id === current.id) + 1}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {programme.levels.length}
                  </span>
                  , with{" "}
                  <span
                    className={
                      current.eligible
                        ? "font-medium text-(--tag-green-fg) tabular-nums"
                        : "font-medium text-foreground tabular-nums"
                    }
                  >
                    {current.achieved}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground tabular-nums">{current.total}</span>{" "}
                  signed off.
                  {current.eligible && !current.completedOn
                    ? " Ready to move up."
                    : ""}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground tabular-nums">{done}</span>{" "}
                  {done === 1 ? "level" : "levels"} finished, and not in a class at the moment.
                </>
              )}
            </p>

            {manage && !programme.graduated && current?.completedOn && nextUp(programme, current) ? (
              <MoveUpToLevel
                studentId={studentId}
                studentName={studentName}
                fromEnrolmentId={openPlaceByLevel[current.id]?.id ?? null}
                fromClassLabel={openPlaceByLevel[current.id]?.label ?? null}
                nextLevelId={nextUp(programme, current)!.id}
                nextLevelName={nextUp(programme, current)!.name}
                courses={courses}
              />
            ) : null}

            <div className="space-y-3">
              {programme.levels.map((level) => (
                <LevelBlock
                  key={level.id}
                  level={level}
                  studentId={studentId}
                  studentName={studentName}
                  manage={manage}
                  admin={admin}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** The rung above the one they have just finished, if there is one. */
function nextUp(programme: ProgrammeProgress, current: LevelProgress) {
  return nextLevel(current.id, programme.levels);
}

function LevelBlock({
  level,
  studentId,
  studentName,
  manage,
  admin,
}: {
  level: LevelProgress;
  studentId: string;
  studentName: string;
  manage: boolean;
  admin: boolean;
}) {
  const completed = Boolean(level.completedOn);

  // Behind them: one line each.
  if (completed) {
    return (
      <div className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2">
        <p className="text-sm font-medium text-foreground">
          {level.name}
          <CompletionTagWrapper level={level} />
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {formatDate(level.completedOn!)}
            {level.confirmedByName ? ` · ${level.confirmedByName}` : ""}
          </p>
          {admin && level.completionId ? (
            <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <RevokeCompletion
                completionId={level.completionId}
                studentName={studentName}
                levelName={level.name}
              />
            </span>
          ) : null}
        </div>
        {level.overrideReason ? (
          <p className="w-full text-xs text-(--tag-orange-fg)">
            Completed with gaps: {level.overrideReason}
          </p>
        ) : null}
      </div>
    );
  }

  // Ahead of them: muted, and not worth opening.
  if (!level.isCurrent) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-dashed px-3 py-2">
        <p className="text-sm text-muted-foreground">{level.name}</p>
        <p className="text-xs text-muted-foreground">
          {level.total === 0 ? "No competencies yet" : `${level.total} to pass`}
        </p>
      </div>
    );
  }

  // Where they are: the working surface.
  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {level.name}
            <Tag color={level.eligible ? "green" : "yellow"} className="ml-2">
              {level.achieved} of {level.total}
            </Tag>
          </h4>
          {level.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{level.description}</p>
          ) : null}
        </div>
        {manage ? (
          <ConfirmLevel
            studentId={studentId}
            levelId={level.id}
            studentName={studentName}
            levelName={level.name}
            achieved={level.achieved}
            total={level.total}
            eligible={level.eligible}
            admin={admin}
          />
        ) : null}
      </div>

      {manage ? (
        <CompetencyChecklist
          studentId={studentId}
          levelId={level.id}
          studentName={studentName}
          competencies={level.competencies}
          readOnly={false}
        />
      ) : (
        <ReadOnlyList level={level} />
      )}
    </section>
  );
}

function CompletionTagWrapper({ level }: { level: LevelProgress }) {
  const snapshot = level.completionSnapshot;
  return (
    <span className="ml-2 inline-flex">
      <CompletionTag
        achieved={snapshot?.achieved ?? level.achieved}
        total={snapshot?.total ?? level.total}
        override={level.overrideReason}
      />
    </span>
  );
}

function ReadOnlyList({ level }: { level: LevelProgress }) {
  if (level.competencies.length === 0) {
    return <p className="text-sm text-muted-foreground">No competencies set for this level yet.</p>;
  }
  return (
    <ul className="overflow-hidden rounded-md border">
      {level.competencies.map((competency) => (
        <li
          key={competency.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2 last:border-0"
        >
          <div className="min-w-0">
            <p className="text-sm text-foreground">{competency.name}</p>
            {assessedLine(competency) ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{assessedLine(competency)}</p>
            ) : null}
          </div>
          {competency.status ? (
            <Tag color={COMPETENCY_STATUS_META[competency.status].color}>
              {COMPETENCY_STATUS_META[competency.status].label}
            </Tag>
          ) : (
            <span className="text-xs text-muted-foreground/70">—</span>
          )}
        </li>
      ))}
    </ul>
  );
}
