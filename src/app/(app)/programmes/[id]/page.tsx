import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { EditProgramme } from "@/components/curriculum/programme-actions";
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
import { permissionPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Programme" };

const ROW_ACTIONS =
  "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100";

export default async function ProgrammePage(props: PageProps<"/programmes/[id]">) {
  await permissionPage("curriculum.manage");
  const { id } = await props.params;

  const programme = await getProgramme(id, true);
  if (!programme) notFound();

  const liveLevels = programme.levels.filter((level) => !level.archivedAt);
  const competencies = programme.levels.reduce(
    (total, level) => total + level.competencies.filter((c) => !c.archivedAt).length,
    0
  );

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
              ? ` · ${level._count.courses} ${level._count.courses === 1 ? "course" : "courses"}`
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
