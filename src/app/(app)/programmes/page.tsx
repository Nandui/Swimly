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

import { CurriculumImage } from "@/components/curriculum/curriculum-image";
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
} from "@/components/curriculum/programme-actions";
import {
  getCurriculumSummary,
  getProgrammes,
} from "@/lib/curriculum/data/curriculum";
import { levelCountLabel } from "@/lib/curriculum/constants";
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

      <Lead>
        <Num>{summary.programmes}</Num>{" "}
        {summary.programmes === 1 ? "programme" : "programmes"}, holding{" "}
        <Num>{summary.levels}</Num> {summary.levels === 1 ? "level" : "levels"}{" "}
        and <Num>{summary.competencies}</Num>{" "}
        {summary.competencies === 1 ? "competency" : "competencies"} between
        them.
      </Lead>

      {live.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No programmes yet"
          hint="A programme is a ladder — Learn to Swim, Squad, Adult Lessons. Add one and give it levels."
          action={<AddProgramme />}
        />
      ) : (
        <ProgrammeTable programmes={live} />
      )}

      {archived.length > 0 ? (
        <section className="min-w-0 flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Archived</h2>
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
          <TableHead scope="col">
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
                  <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                    {ARCHIVAL_STATUS_META.archived.label}
                  </Tag>
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
            <TableCell className="w-28 md:w-auto">
              <div
                className={
                  "min-w-0 flex gap-1 items-center justify-end flex-wrap"
                }
              >
                {archived ? null : (
                  <MoveProgramme
                    programme={programme}
                    first={index === 0}
                    last={index === programmes.length - 1}
                  />
                )}
                <EditProgramme programme={programme} />
                <ArchiveProgramme programme={programme} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
