import { ClipboardCheck } from "lucide-react";

import { plural } from "@/lib/format";
import { CurriculumImage } from "@/modules/activities/components/curriculum/curriculum-image";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { EditProgramme } from "@/modules/activities/components/curriculum/programme-actions";
import {
  AddAssessmentType,
  ArchiveAssessmentType,
  EditAssessmentType,
} from "@/modules/activities/components/assessments/type-actions";
import { getAssessmentTypes } from "@/modules/activities/lib/assessments/data/assessments";
import {
  AddCompetency,
  AddLevel,
  ArchiveCompetency,
  ArchiveLevel,
  EditCompetency,
  EditLevel,
  MoveCompetency,
  MoveLevel,
} from "@/modules/activities/components/curriculum/level-actions";
import { competencyCountLabel } from "@/modules/activities/lib/curriculum/constants";
import {
  getProgramme,
  type CompetencyDetail,
  type LevelDetail,
} from "@/modules/activities/lib/curriculum/data/curriculum";
import { screenPage } from "@/lib/page-guards";

/** One query per request, shared by the page and its tab title. */
const loadProgramme = cache(getProgramme);

export async function generateMetadata(props: PageProps<"/programmes/[id]">): Promise<Metadata> {
  await screenPage("programmes", "curriculum.manage");
  const programme = await loadProgramme((await props.params).id, true);
  return { title: programme?.name ?? "Page not found" };
}

export default async function ProgrammePage(
  props: PageProps<"/programmes/[id]">,
) {
  await screenPage("programmes", "curriculum.manage");
  const { id } = await props.params;

  const [programme, assessmentTypes] = await Promise.all([
    loadProgramme(id, true),
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
      <PageHeader
        back={{ href: "/programmes", label: "Programmes" }}
        title={
          <span className="min-w-0 flex gap-2 items-center">
            <CurriculumImage
              kind="programme"
              id={programme.id}
              name={programme.name}
            />
            {programme.name}
          </span>
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

      <Lead>
        <Num>{liveLevels.length}</Num>{" "}
        {liveLevels.length === 1 ? "level" : "levels"}, worked through in this
        order, with <Num>{competencies}</Num>{" "}
        {competencies === 1 ? "competency" : "competencies"} between them.
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

      <section className="pc-panel" aria-labelledby="assessment-kinds">
        <div className="pc-panel-head">
          <h2 id="assessment-kinds">Kinds of assessment</h2>
          {programme.archivedAt ? null : (
            <AddAssessmentType
              programmeId={programme.id}
              programmeName={programme.name}
            />
          )}
        </div>
        <Lead>
          What an assessment session for this programme can be, such as new
          swimmers or mixed abilities. The desk picks one when adding a session.
        </Lead>
        {assessmentTypes.length === 0 ? (
          <EmptyState
            compact
            title="None yet"
            hint="Add one and it becomes something a session can be."
          />
        ) : (
          <ul className="pc-rows">
            {assessmentTypes.map((type) => (
              <li key={type.id} className="pc-row [overflow-wrap:anywhere]">
                <span className="pc-tile-icon">
                  <ClipboardCheck aria-hidden="true" />
                </span>
                <div className="pc-row-body">
                  <span className="pc-row-title flex gap-2 items-center flex-wrap">
                    {type.name}
                    {type.archivedAt ? (
                      <Tag meta={ARCHIVAL_STATUS_META.archived} />
                    ) : null}
                  </span>
                  <span className="pc-row-hint">{`${type.description ? `${type.description} · ` : ""}${plural(type._count.sessions, "session")}`}</span>
                </div>
                <div className="pc-row-trail">
                  <EditAssessmentType type={type} />
                  <ArchiveAssessmentType
                    type={type}
                    sessions={type._count.sessions}
                  />
                </div>
              </li>
            ))}
          </ul>
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

  const headingId = `level-${level.id}`;
  const caption = [
    level.description,
    competencyCountLabel(live.length),
    level._count.courses > 0
      ? plural(level._count.courses, "class", "classes")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="pc-panel" aria-labelledby={headingId}>
      <div className="flex flex-col gap-1">
        <div className="pc-panel-head">
          <h2
            id={headingId}
            className="min-w-0 flex gap-2 items-center flex-wrap"
          >
            <CurriculumImage kind="level" id={level.id} name={level.name} />
            {level.name}
            {archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
          </h2>
          <div className="min-w-0 flex gap-2 items-center flex-wrap">
            {archived ? null : (
              <MoveLevel level={level} first={first} last={last} />
            )}
            <EditLevel level={level} />
            <ArchiveLevel level={level} />
          </div>
        </div>
        <p className="text-sm text-ui-muted-foreground">{caption}</p>
      </div>

      {level.competencies.length === 0 ? (
        <EmptyState
          compact
          title="No competencies yet"
          hint={`Add the first competency and it becomes what completing ${level.name} means.`}
          action={
            archived ? undefined : (
              <AddCompetency levelId={level.id} levelName={level.name} />
            )
          }
        />
      ) : (
        <>
          <ul className="pc-rows">
            {numberLive(level.competencies).map(
              ({ competency, position, first, last }) => (
                <li
                  key={competency.id}
                  className="pc-row [overflow-wrap:anywhere]"
                >
                  {position !== null ? (
                    <span className="pc-tile-icon font-semibold tabular-nums">
                      {position}
                    </span>
                  ) : null}
                  <div className="pc-row-body">
                    <span className="pc-row-title flex gap-2 items-center flex-wrap">
                      {competency.name}
                      {competency.archivedAt ? (
                        <Tag meta={ARCHIVAL_STATUS_META.archived} />
                      ) : null}
                    </span>
                    {competency.description ? (
                      <span className="pc-row-hint">
                        {competency.description}
                      </span>
                    ) : null}
                  </div>
                  <div className="pc-row-trail">
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
                </li>
              ),
            )}
          </ul>
          {archived ? null : (
            <div>
              <AddCompetency levelId={level.id} levelName={level.name} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
