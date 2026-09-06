import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
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
 *  The ladder is rows: the levels behind them and ahead of them are one
 *  line each in a list, and the rung they are on opens between them as a
 *  section holding the working checklist. That is the Collapse-Not-Scroll
 *  rule applied down the page rather than across it — a full curriculum is
 *  sixty-odd rows, and only one rung is live at a time. */
export function ProgressSection({
  programmes,
  studentId,
  studentName,
  manage,
  complete = manage,
  admin,
  courses = [],
  openPlaceByLevel = {},
}: {
  programmes: ProgrammeProgress[];
  studentId: string;
  studentName: string;
  manage: boolean;
  /** May confirm a level as done. Marking and confirming are separate
   *  permissions; a caller that does not say assumes they go together. */
  complete?: boolean;
  admin: boolean;
  /** Classes they could be moved into. The pages already load this. */
  courses?: MoveTarget[];
  /** Their open place at each level, so a move up closes the right one. */
  openPlaceByLevel?: Record<string, { id: string; label: string }>;
}) {
  if (programmes.length === 0) {
    return (
      <Text as="p" display="block" color="secondary">
        Nothing to show yet — progress starts once they are enrolled in a class.
      </Text>
    );
  }

  return (
    <VStack gap={8}>
      {programmes.map((programme) => {
        const current = programme.levels.find((level) => level.isCurrent) ?? null;
        const done = programme.levels.filter((level) => level.completedOn).length;
        const next = current ? nextUp(programme, current) : null;

        return (
          <VStack key={programme.programmeId} gap={4} as="section">
            <VStack gap={1}>
              <Heading level={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {programme.programmeName}
                  {programme.graduated ? <Tag color="blue">Graduated</Tag> : null}
                </HStack>
              </Heading>

              <Lead>
                {programme.graduated ? (
                  <>
                    Every level finished — all <Num>{programme.levels.length}</Num> of them.
                  </>
                ) : current?.completedOn ? (
                  <>
                    Finished <Num>{current.name}</Num> on {formatDate(current.completedOn)}
                    {next ? (
                      <>
                        {" "}
                        — ready for <Num>{next.name}</Num>, once they are in a class for it.
                      </>
                    ) : (
                      <>, the last level in the programme.</>
                    )}
                  </>
                ) : current ? (
                  <>
                    At <Num>{current.name}</Num>, level{" "}
                    <Num>{programme.levels.findIndex((level) => level.id === current.id) + 1}</Num>{" "}
                    of <Num>{programme.levels.length}</Num>, with{" "}
                    {current.eligible ? (
                      <Alert tone="warning">{current.achieved}</Alert>
                    ) : (
                      <Num>{current.achieved}</Num>
                    )}{" "}
                    of <Num>{current.total}</Num> signed off.
                    {current.eligible && !current.completedOn ? " Ready to move up." : ""}
                  </>
                ) : (
                  <>
                    <Num>{done}</Num> {done === 1 ? "level" : "levels"} finished, and not in a
                    class at the moment.
                  </>
                )}
              </Lead>
            </VStack>

            {manage && !programme.graduated && current?.completedOn && next ? (
              <MoveUpToLevel
                studentId={studentId}
                studentName={studentName}
                fromEnrolmentId={openPlaceByLevel[current.id]?.id ?? null}
                fromClassLabel={openPlaceByLevel[current.id]?.label ?? null}
                nextLevelId={next.id}
                nextLevelName={next.name}
                courses={courses}
              />
            ) : null}

            <Ladder
              levels={programme.levels}
              studentId={studentId}
              studentName={studentName}
              manage={manage}
              complete={complete}
              admin={admin}
            />
          </VStack>
        );
      })}
    </VStack>
  );
}

/** The rung above the one they have just finished, if there is one. */
function nextUp(programme: ProgrammeProgress, current: LevelProgress) {
  return nextLevel(current.id, programme.levels);
}

type LadderProps = {
  studentId: string;
  studentName: string;
  manage: boolean;
  complete: boolean;
  admin: boolean;
};

/** The levels in order: runs of one-line rows, with the current rung opened
 *  as a section wherever it falls. */
function Ladder({ levels, ...rest }: LadderProps & { levels: LevelProgress[] }) {
  const runs: Array<{ key: string; rows: LevelProgress[] } | { key: string; current: LevelProgress }> = [];
  for (const level of levels) {
    if (level.isCurrent && !level.completedOn) {
      runs.push({ key: level.id, current: level });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last && "rows" in last) last.rows.push(level);
    else runs.push({ key: level.id, rows: [level] });
  }

  return (
    <VStack gap={4}>
      {runs.map((run) =>
        "current" in run ? (
          <CurrentLevel key={run.key} level={run.current} {...rest} />
        ) : (
          <List key={run.key} hasDividers>
            {run.rows.map((level) => (
              <LevelRow key={level.id} level={level} {...rest} />
            ))}
          </List>
        )
      )}
    </VStack>
  );
}

/** A rung behind them or ahead of them: one line. */
function LevelRow({ level, studentName, admin }: LadderProps & { level: LevelProgress }) {
  if (level.completedOn) {
    return (
      <Item
        as="li"
        label={
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{level.name}</Text>
            <CompletionTagWrapper level={level} />
          </HStack>
        }
        description={
          level.overrideReason
            ? `Completed with gaps: ${level.overrideReason}`
            : undefined
        }
        endContent={
          <HStack gap={3} vAlign="center">
            <Text color="secondary" textWrap="nowrap">
              {formatDate(level.completedOn)}
              {level.confirmedByName ? ` · ${level.confirmedByName}` : ""}
            </Text>
            {admin && level.completionId ? (
              <RevokeCompletion
                completionId={level.completionId}
                studentName={studentName}
                levelName={level.name}
              />
            ) : null}
          </HStack>
        }
      />
    );
  }

  return (
    <Item
      as="li"
      label={<Text color="secondary">{level.name}</Text>}
      endContent={
        <Text color="secondary" textWrap="nowrap">
          {level.total === 0 ? "No competencies yet" : `${level.total} to pass`}
        </Text>
      }
    />
  );
}

/** Where they are: the working surface. */
function CurrentLevel({
  level,
  studentId,
  studentName,
  manage,
  complete,
  admin,
}: LadderProps & { level: LevelProgress }) {
  return (
    <Section variant="muted" padding={4}>
      <VStack gap={4}>
        <HStack gap={4} vAlign="start" hAlign="between" wrap="wrap">
          <StackItem size="fill">
            <Heading level={3}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                {level.name}
                <Tag color={level.eligible ? "green" : "yellow"}>
                  {level.achieved} of {level.total}
                </Tag>
              </HStack>
            </Heading>
            {level.description ? (
              <Text as="p" display="block" color="secondary">
                {level.description}
              </Text>
            ) : null}
          </StackItem>
          {complete ? (
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
        </HStack>

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
      </VStack>
    </Section>
  );
}

function CompletionTagWrapper({ level }: { level: LevelProgress }) {
  const snapshot = level.completionSnapshot;
  return (
    <CompletionTag
      achieved={snapshot?.achieved ?? level.achieved}
      total={snapshot?.total ?? level.total}
      override={level.overrideReason}
    />
  );
}

/** Rows with hairlines inside the level's section. */
function ReadOnlyList({ level }: { level: LevelProgress }) {
  if (level.competencies.length === 0) {
    return (
      <Text as="p" display="block" color="secondary">
        No competencies set for this level yet.
      </Text>
    );
  }
  return (
    <List hasDividers>
      {level.competencies.map((competency) => (
        <Item
          key={competency.id}
          as="li"
          label={competency.name}
          description={assessedLine(competency) ?? undefined}
          endContent={
            competency.status ? (
              <Tag color={COMPETENCY_STATUS_META[competency.status].color}>
                {COMPETENCY_STATUS_META[competency.status].label}
              </Tag>
            ) : (
              <Text color="disabled">—</Text>
            )
          }
        />
      ))}
    </List>
  );
}
