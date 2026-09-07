import { CurriculumImage } from "@/components/curriculum/curriculum-image";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { WrongClub } from "@/components/clubs/wrong-club";
import { CopyProgramme } from "@/components/curriculum/copy-programme";
import { EditProgramme } from "@/components/curriculum/programme-actions";
import {
  AddAssessmentType,
  ArchiveAssessmentType,
  EditAssessmentType,
} from "@/components/assessments/type-actions";
import { getAssessmentTypes } from "@/lib/assessments/data/assessments";
import {
  AddCompetency,
  AddLevel,
  ArchiveCompetency,
  ArchiveLevel,
  EditCompetency,
  EditLevel,
  MoveCompetency,
  MoveLevel,
} from "@/components/curriculum/level-actions";
import { getCurrentClub } from "@/lib/clubs/current";
import { competencyCountLabel } from "@/lib/curriculum/constants";
import {
  getProgramme,
  type CompetencyDetail,
  type LevelDetail,
} from "@/lib/curriculum/data/curriculum";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Programme" };

export default async function ProgrammePage(props: PageProps<"/programmes/[id]">) {
  await screenPage("programmes", "curriculum.manage");
  const { id } = await props.params;

  const [programme, assessmentTypes, { club, clubs }] = await Promise.all([
    getProgramme(id, true),
    getAssessmentTypes(id),
    getCurrentClub(),
  ]);
  if (!programme) notFound();
  if (programme.clubId !== club.id) {
    return (
      <WrongClub what={`The programme ${programme.name}`} owner={programme.club} current={club} />
    );
  }

  const liveLevels = programme.levels.filter((level) => !level.archivedAt);
  const competencies = programme.levels.reduce(
    (total, level) => total + level.competencies.filter((c) => !c.archivedAt).length,
    0
  );
  // Where it could be copied to: every other live club.
  const otherClubs = clubs.filter((other) => other.id !== programme.clubId);

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <BackLink href="/programmes" current={programme.name}>
          Programmes
        </BackLink>
        <PageHeader
          title={<HStack gap={2} vAlign="center"><CurriculumImage kind="programme" id={programme.id} name={programme.name} />{programme.name}</HStack>}
          description={programme.description ?? undefined}
          actions={
            <>
              {programme.archivedAt ? null : (
                <CopyProgramme
                  programme={programme}
                  clubs={otherClubs}
                  levels={liveLevels.length}
                  competencies={competencies}
                />
              )}
              <EditProgramme programme={{ ...programme, archivedAt: programme.archivedAt }} variant="button" />
              <AddLevel programmeId={programme.id} />
            </>
          }
        />
      </VStack>

      <Lead>
        <Num>{liveLevels.length}</Num> {liveLevels.length === 1 ? "level" : "levels"}, worked
        through in this order, with <Num>{competencies}</Num>{" "}
        {competencies === 1 ? "competency" : "competencies"} between them. Every competency in a
        level has to be signed off before a swimmer can complete it.
      </Lead>

      {programme.levels.length === 0 ? (
        <EmptyState
          title="No levels yet"
          hint="Levels are the rungs of the ladder. Add the first one and give it the competencies a swimmer has to pass."
          action={<AddLevel programmeId={programme.id} />}
        />
      ) : (
        <VStack gap={4}>
          {programme.levels.map((level, index) => (
            <LevelSection
              key={level.id}
              level={level}
              first={index === 0}
              last={index === programme.levels.length - 1}
            />
          ))}
        </VStack>
      )}

      <VStack gap={3} as="section">
        <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
          <Heading level={2}>Kinds of assessment</Heading>
          {programme.archivedAt ? null : (
            <AddAssessmentType programmeId={programme.id} programmeName={programme.name} />
          )}
        </HStack>
        <Lead>
          What an assessment session for this programme can be — new swimmers, mixed abilities.
          The desk picks one when adding a session.
        </Lead>
        {assessmentTypes.length === 0 ? (
          <EmptyState compact title="None yet" hint="Add one and it becomes something a session can be." />
        ) : (
          <List hasDividers>
            {assessmentTypes.map((type) => (
              <Item
                key={type.id}
                as="li"
                align="start"
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    {type.name}
                    {type.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                  </HStack>
                }
                description={`${type.description ? `${type.description} · ` : ""}${type._count.sessions} ${type._count.sessions === 1 ? "session" : "sessions"}`}
                endContent={
                  <HStack gap={1} vAlign="center">
                    <EditAssessmentType type={type} />
                    <ArchiveAssessmentType type={type} sessions={type._count.sessions} />
                  </HStack>
                }
              />
            ))}
          </List>
        )}
      </VStack>
    </VStack>
  );
}

/** Archived competencies sink to the bottom and take no number, so the live
 *  list reads as the sequence a swimmer actually works through — the same
 *  1..n they see on the assessment checklist. Numbering the retired ones in
 *  place would leave the live curriculum reading 2, 4, 5, 6.
 *
 *  `first`/`last` are the ends of the *live* run for the same reason: the
 *  reorder arrows move a competency past its live neighbours, not past a row
 *  nobody is assessed on any more. */
function numberLive(competencies: CompetencyDetail[]) {
  const live = competencies.filter((competency) => !competency.archivedAt);
  const archived = competencies.filter((competency) => competency.archivedAt);

  return [
    ...live.map((competency, index) => ({
      competency,
      position: index + 1,
      first: index === 0,
      last: index === live.length - 1,
    })),
    ...archived.map((competency) => ({
      competency,
      position: null,
      first: false,
      last: false,
    })),
  ];
}

/** One rung of the ladder: its head, then its competencies as rows, then
 *  the way to add one. A Section rather than a Card: it is a region of the
 *  page, not a thing to reorder on its own. */
function LevelSection({
  level,
  first,
  last,
}: {
  level: LevelDetail;
  first: boolean;
  last: boolean;
}) {
  const archived = Boolean(level.archivedAt);
  const live = level.competencies.filter((c) => !c.archivedAt);

  return (
    <Section padding={0} dividers={["top", "bottom"]}>
      <VStack gap={0}>
        <HStack gap={3} vAlign="start" paddingInline={3} paddingBlock={2}>
          <StackItem size="fill">
            <VStack gap={0.5}>
              <Heading level={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <CurriculumImage kind="level" id={level.id} name={level.name} />
                  {level.name}
                  {archived ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                </HStack>
              </Heading>
              {level.description ? (
                <Text type="supporting" display="block">
                  {level.description}
                </Text>
              ) : null}
              <Text type="supporting" display="block">
                {competencyCountLabel(live.length)}
                {level._count.courses > 0
                  ? ` · ${level._count.courses} ${level._count.courses === 1 ? "class" : "classes"}`
                  : ""}
              </Text>
            </VStack>
          </StackItem>
          <HStack gap={1} vAlign="center">
            {archived ? null : <MoveLevel level={level} first={first} last={last} />}
            <EditLevel level={level} />
            <ArchiveLevel level={level} />
          </HStack>
        </HStack>

        {level.competencies.length === 0 ? (
          <Text as="p" display="block" color="secondary" justify="center" className="px-3 py-6">
            Nothing to pass yet. Add the first competency and it becomes what completing{" "}
            {level.name} means.
          </Text>
        ) : (
          <List hasDividers listStyle="none">
            {numberLive(level.competencies).map(({ competency, position, first, last }) => (
              <Item
                key={competency.id}
                as="li"
                align="start"
                marker={
                  <Text type="supporting" hasTabularNumbers className="inline-block w-4">
                    {position ?? ""}
                  </Text>
                }
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    {competency.name}
                    {competency.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                  </HStack>
                }
                description={competency.description ?? undefined}
                endContent={
                  <HStack gap={1} vAlign="center">
                    {competency.archivedAt ? null : (
                      <MoveCompetency competency={competency} first={first} last={last} />
                    )}
                    <EditCompetency competency={competency} />
                    <ArchiveCompetency
                      competency={competency}
                      assessed={competency._count.results}
                    />
                  </HStack>
                }
              />
            ))}
          </List>
        )}

        {archived ? null : (
          <HStack paddingInline={3} paddingBlock={2}>
            <AddCompetency levelId={level.id} levelName={level.name} />
          </HStack>
        )}
      </VStack>
    </Section>
  );
}
