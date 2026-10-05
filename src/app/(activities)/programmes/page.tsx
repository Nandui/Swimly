import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/shadcn/table";
import { cn } from "@/lib/utils";

import UiLink from "next/link";

import { CurriculumImage } from "@/modules/activities/components/curriculum/curriculum-image";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddProgramme,
  ArchiveProgramme,
  EditProgramme,
  MoveProgramme,
} from "@/modules/activities/components/curriculum/programme-actions";
import {
  getCurriculumSummary,
  getProgrammes,
} from "@/modules/activities/lib/curriculum/data/curriculum";
import { levelCountLabel } from "@/modules/activities/lib/curriculum/constants";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Programmes" };

export default async function ProgrammesPage() {
  await screenPage("programmes", "curriculum.manage");

  const [programmes, summary] = await Promise.all([
    getProgrammes(true),
    getCurriculumSummary(),
  ]);

  const live = programmes.filter((p) => !p.archivedAt);
  const archived = programmes.filter((p) => p.archivedAt);

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Programmes"
        description="The curriculum: what a swimmer works through, in the order they work through it."
        actions={<AddProgramme />}
      />

      {live.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No programmes yet"
          hint="A programme is a ladder: Learn to swim, Squad, Adult lessons. Add one and give it levels."
          action={<AddProgramme />}
        />
      ) : (
        <section className="pc-panel" aria-label="Programmes in use">
          <Lead>
            <Num>{summary.programmes}</Num>{" "}
            {summary.programmes === 1 ? "programme" : "programmes"}, holding{" "}
            <Num>{summary.levels}</Num>{" "}
            {summary.levels === 1 ? "level" : "levels"} and{" "}
            <Num>{summary.competencies}</Num>{" "}
            {summary.competencies === 1 ? "competency" : "competencies"} between
            them.
          </Lead>
          <ProgrammeTable programmes={live} />
        </section>
      )}

      {archived.length > 0 ? (
        <section className="pc-panel">
          <h2 className="text-lg font-semibold">Archived</h2>
          <Lead>
            Not offered any more. Everything recorded against them is still
            readable.
          </Lead>
          <ProgrammeTable programmes={archived} archived />
        </section>
      ) : null}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof getProgrammes>>[number];

function ProgrammeTable({
  programmes,
  archived,
}: {
  programmes: Row[];
  archived?: boolean;
}) {
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Programme</TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Levels
          </TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Enrolments
          </TableHead>
          <TableHead scope="col" className="max-md:hidden">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programmes.map((programme, index) => (
          <TableRow key={programme.id}>
            <TableCell>
              <div className="min-w-0 flex gap-2 items-center flex-wrap">
                <CurriculumImage
                  kind="programme"
                  id={programme.id}
                  name={programme.name}
                />
                <UiLink
                  href={`/programmes/${programme.id}`}
                  className={
                    "text-ui-foreground underline-offset-4 hover:underline font-medium"
                  }
                >
                  {programme.name}
                </UiLink>
                {archived ? (
                  <Tag meta={ARCHIVAL_STATUS_META.archived} />
                ) : null}
              </div>
              {programme.description ? (
                <span className="text-sm text-ui-muted-foreground block">
                  {programme.description}
                </span>
              ) : null}
              <span
                className={cn(
                  "text-sm text-ui-muted-foreground block",
                  "md:hidden",
                )}
              >
                {levelCountLabel(programme._count.levels)} ·{" "}
                {programme._count.enrolments} enrolled
              </span>
              <div className="md:hidden mt-3">
                <ProgrammeRowActions
                  programme={programme}
                  archived={archived}
                  first={index === 0}
                  last={index === programmes.length - 1}
                />
              </div>
            </TableCell>
            <TableCell className={"max-md:hidden"}>
              <span className="text-sm text-ui-muted-foreground tabular-nums">
                {programme._count.levels}
              </span>
            </TableCell>
            <TableCell className={"max-md:hidden"}>
              <span className="text-sm text-ui-muted-foreground tabular-nums">
                {programme._count.enrolments}
              </span>
            </TableCell>
            <TableCell className="max-md:hidden">
              <ProgrammeRowActions
                programme={programme}
                archived={archived}
                first={index === 0}
                last={index === programmes.length - 1}
                end
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Reorder pair in a fixed slot, then Edit and Archive. On phones the row
 *  shows these under the name instead of in a squeezed trailing column. */
function ProgrammeRowActions({
  programme,
  archived,
  first,
  last,
  end,
}: {
  programme: Row;
  archived?: boolean;
  first: boolean;
  last: boolean;
  end?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex gap-2 items-center flex-wrap",
        end && "justify-end",
      )}
    >
      {archived ? null : (
        <MoveProgramme programme={programme} first={first} last={last} />
      )}
      <EditProgramme programme={programme} />
      <ArchiveProgramme programme={programme} />
    </div>
  );
}
