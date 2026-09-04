import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
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

const ROW_ACTIONS =
  "flex shrink-0 items-center gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100";

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
    <div className="space-y-6">
      <div>
        <Link
          href="/programmes"
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Programmes
        </Link>
        <PageHeader
          title={programme.name}
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
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{liveLevels.length}</span>{" "}
        {liveLevels.length === 1 ? "level" : "levels"}, worked through in this order, with{" "}
        <span className="font-medium text-foreground tabular-nums">{competencies}</span>{" "}
        {competencies === 1 ? "competency" : "competencies"} between them. Every competency in a
        level has to be signed off before a swimmer can complete it.
      </p>

      {programme.levels.length === 0 ? (
        <div className="rounded-md border border-dashed px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No levels yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Levels are the rungs of the ladder. Add the first one and give it the competencies a
            swimmer has to pass.
          </p>
          <div className="mt-4 flex justify-center">
            <AddLevel programmeId={programme.id} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Kinds of assessment</h2>
          {programme.archivedAt ? null : (
            <AddAssessmentType programmeId={programme.id} programmeName={programme.name} />
          )}
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          What an assessment session for this programme can be — new swimmers, mixed abilities.
          The desk picks one when adding a session.
        </p>
        {assessmentTypes.length === 0 ? (
          <p className="rounded-md border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            None yet. Add one and it becomes something a session can be.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border">
            {assessmentTypes.map((type) => (
              <li
                key={type.id}
                className="group flex items-start justify-between gap-3 border-b px-3 py-2 transition-colors last:border-0 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {type.name}
                    {type.archivedAt ? (
                      <Tag color="gray" className="ml-2">
                        Archived
                      </Tag>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {type.description ? `${type.description} · ` : ""}
                    {type._count.sessions} {type._count.sessions === 1 ? "session" : "sessions"}
                  </p>
                </div>
                <div className={ROW_ACTIONS}>
                  <EditAssessmentType type={type} />
                  <ArchiveAssessmentType type={type} sessions={type._count.sessions} />
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
    <section className="overflow-hidden rounded-md border">
      <div className="group flex items-start gap-3 border-b bg-sidebar px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {level.name}
            {archived ? (
              <Tag color="gray" className="ml-2">
                Archived
              </Tag>
            ) : null}
          </h2>
          {level.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{level.description}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {competencyCountLabel(live.length)}
            {level._count.courses > 0
              ? ` · ${level._count.courses} ${level._count.courses === 1 ? "class" : "classes"}`
              : ""}
          </p>
        </div>
        <div className={ROW_ACTIONS}>
          {archived ? null : <MoveLevel level={level} first={first} last={last} />}
          <EditLevel level={level} />
          <ArchiveLevel level={level} />
        </div>
      </div>

      {level.competencies.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing to pass yet. Add the first competency and it becomes what completing{" "}
          {level.name} means.
        </p>
      ) : (
        <ol>
          {numberLive(level.competencies).map(({ competency, position, first, last }) => (
            <li
              key={competency.id}
              className="group flex items-start gap-3 border-b px-3 py-2 transition-colors last:border-0 hover:bg-accent/40"
            >
              <span className="w-4 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                {position ?? ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  {competency.name}
                  {competency.archivedAt ? (
                    <Tag color="gray" className="ml-2">
                      Archived
                    </Tag>
                  ) : null}
                </p>
                {competency.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{competency.description}</p>
                ) : null}
              </div>
              <div className={ROW_ACTIONS}>
                {competency.archivedAt ? null : (
                  <MoveCompetency competency={competency} first={first} last={last} />
                )}
                <EditCompetency competency={competency} />
                <ArchiveCompetency
                  competency={competency}
                  assessed={competency._count.results}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {archived ? null : (
        <div className="border-t px-3 py-2">
          <AddCompetency levelId={level.id} levelName={level.name} />
        </div>
      )}
    </section>
  );
}
