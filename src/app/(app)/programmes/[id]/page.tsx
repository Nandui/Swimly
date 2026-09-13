import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
  ItemMedia,
} from "@/components/shadcn/item";

import { cn } from "@/lib/utils";

import { CurriculumImage } from "@/components/curriculum/curriculum-image";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
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
import { competencyCountLabel } from "@/lib/curriculum/constants";
import {
  getProgramme,
  type CompetencyDetail,
  type LevelDetail,
} from "@/lib/curriculum/data/curriculum";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Programme" };

export default async function ProgrammePage(
  props: PageProps<"/programmes/[id]">,
) {
  await screenPage("programmes", "curriculum.manage");
  const { id } = await props.params;

  const [programme, assessmentTypes] = await Promise.all([
    getProgramme(id, true),
    getAssessmentTypes(id),
  ]);
  if (!programme) notFound();

  const liveLevels = programme.levels.filter((level) => !level.archivedAt);
  const competencies = programme.levels.reduce(
    (total, level) =>
      total + level.competencies.filter((c) => !c.archivedAt).length,
    0,
  );

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <div className="min-w-0 flex flex-col gap-2">
        <BackLink href="/programmes" current={programme.name}>
          Programmes
        </BackLink>
        <PageHeader
          title={
            <div className="min-w-0 flex gap-2 items-center">
              <CurriculumImage
                kind="programme"
                id={programme.id}
                name={programme.name}
              />
              {programme.name}
            </div>
          }
          description={programme.description ?? undefined}
          actions={
            <>
              <EditProgramme
                programme={{ ...programme, archivedAt: programme.archivedAt }}
                variant="button"
              />
              <AddLevel programmeId={programme.id} />
            </>
          }
        />
      </div>

      <Lead>
        <Num>{liveLevels.length}</Num>{" "}
        {liveLevels.length === 1 ? "level" : "levels"}, worked through in this
        order, with <Num>{competencies}</Num>{" "}
        {competencies === 1 ? "competency" : "competencies"} between them. Every
        competency in a level has to be signed off before a swimmer can complete
        it. Curriculum and progress are shared across all sites.
      </Lead>

      {programme.levels.length === 0 ? (
        <EmptyState
          title="No levels yet"
          hint="Levels are the rungs of the ladder. Add the first one and give it the competencies a swimmer has to pass."
          action={<AddLevel programmeId={programme.id} />}
        />
      ) : (
        <div className="min-w-0 flex flex-col gap-4">
          {programme.levels.map((level, index) => (
            <LevelSection
              key={level.id}
              level={level}
              first={index === 0}
              last={index === programme.levels.length - 1}
            />
          ))}
        </div>
      )}

      <section className="min-w-0 flex flex-col gap-3">
        <div
          className={
            "min-w-0 flex gap-2 items-center justify-between flex-wrap"
          }
        >
          <h2 className="text-xl font-semibold tracking-tight">
            Kinds of assessment
          </h2>
          {programme.archivedAt ? null : (
            <AddAssessmentType
              programmeId={programme.id}
              programmeName={programme.name}
            />
          )}
        </div>
        <Lead>
          What an assessment session for this programme can be — new swimmers,
          mixed abilities. The desk picks one when adding a session.
        </Lead>
        {assessmentTypes.length === 0 ? (
          <EmptyState
            compact
            title="None yet"
            hint="Add one and it becomes something a session can be."
          />
        ) : (
          <ItemGroup className="divide-y divide-ui-border">
            {assessmentTypes.map((type) => (
              <Item
                key={type.id}
                role="listitem"
                className="items-start [overflow-wrap:anywhere]"
              >
                <ItemContent className="min-w-0">
                  <div className="text-sm font-medium">
                    {
                      <div className="min-w-0 flex gap-2 items-center flex-wrap">
                        {type.name}
                        {type.archivedAt ? (
                          <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                            {ARCHIVAL_STATUS_META.archived.label}
                          </Tag>
                        ) : null}
                      </div>
                    }
                  </div>
                  <div className="text-sm text-ui-muted-foreground">{`${type.description ? `${type.description} · ` : ""}${type._count.sessions} ${type._count.sessions === 1 ? "session" : "sessions"}`}</div>
                </ItemContent>
                <ItemActions className="flex-wrap">
                  {
                    <div className="min-w-0 flex gap-1 items-center">
                      <EditAssessmentType type={type} />
                      <ArchiveAssessmentType
                        type={type}
                        sessions={type._count.sessions}
                      />
                    </div>
                  }
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
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
    <section
      className={
        "min-w-0 space-y-4 border-t border-ui-border border-b border-ui-border p-0"
      }
    >
      <div className="min-w-0 flex flex-col gap-0">
        <div className="min-w-0 flex gap-3 items-start px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="min-w-0 flex flex-col gap-0.5">
              <h2 className="text-xl font-semibold tracking-tight">
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  <CurriculumImage
                    kind="level"
                    id={level.id}
                    name={level.name}
                  />
                  {level.name}
                  {archived ? (
                    <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                      {ARCHIVAL_STATUS_META.archived.label}
                    </Tag>
                  ) : null}
                </div>
              </h2>
              {level.description ? (
                <span className="text-sm text-ui-muted-foreground block">
                  {level.description}
                </span>
              ) : null}
              <span className="text-sm text-ui-muted-foreground block">
                {competencyCountLabel(live.length)}
                {level._count.courses > 0
                  ? ` · ${level._count.courses} ${level._count.courses === 1 ? "class" : "classes"}`
                  : ""}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex gap-1 items-center">
            {archived ? null : (
              <MoveLevel level={level} first={first} last={last} />
            )}
            <EditLevel level={level} />
            <ArchiveLevel level={level} />
          </div>
        </div>

        {level.competencies.length === 0 ? (
          <p
            className={cn(
              "text-sm text-ui-muted-foreground block text-center",
              "px-3 py-6",
            )}
          >
            Nothing to pass yet. Add the first competency and it becomes what
            completing {level.name} means.
          </p>
        ) : (
          <ItemGroup className="divide-y divide-ui-border">
            {numberLive(level.competencies).map(
              ({ competency, position, first, last }) => (
                <Item
                  key={competency.id}
                  role="listitem"
                  className="items-start [overflow-wrap:anywhere]"
                >
                  <ItemMedia>
                    {
                      <span
                        className={cn(
                          "text-sm text-ui-muted-foreground tabular-nums",
                          "inline-block w-4",
                        )}
                      >
                        {position ?? ""}
                      </span>
                    }
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <div className="text-sm font-medium">
                      {
                        <div
                          className={
                            "min-w-0 flex gap-2 items-center flex-wrap"
                          }
                        >
                          {competency.name}
                          {competency.archivedAt ? (
                            <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                              {ARCHIVAL_STATUS_META.archived.label}
                            </Tag>
                          ) : null}
                        </div>
                      }
                    </div>
                    <div className="text-sm text-ui-muted-foreground">
                      {competency.description ?? undefined}
                    </div>
                  </ItemContent>
                  <ItemActions className="flex-wrap">
                    {
                      <div className="min-w-0 flex gap-1 items-center">
                        {competency.archivedAt ? null : (
                          <MoveCompetency
                            competency={competency}
                            first={first}
                            last={last}
                          />
                        )}
                        <EditCompetency competency={competency} />
                        <ArchiveCompetency
                          competency={competency}
                          assessed={competency._count.results}
                        />
                      </div>
                    }
                  </ItemActions>
                </Item>
              ),
            )}
          </ItemGroup>
        )}

        {archived ? null : (
          <div className="min-w-0 flex gap-2 items-center px-3 py-2">
            <AddCompetency levelId={level.id} levelName={level.name} />
          </div>
        )}
      </div>
    </section>
  );
}
