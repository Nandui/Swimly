import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddProgramme,
  ArchiveProgramme,
  EditProgramme,
  MoveProgramme,
} from "@/components/curriculum/programme-actions";
import { getCurriculumSummary, getProgrammes } from "@/lib/curriculum/data/curriculum";
import { levelCountLabel } from "@/lib/curriculum/constants";
import { adminPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Programmes" };

export default async function ProgrammesPage() {
  await adminPage();

  const [programmes, summary] = await Promise.all([
    getProgrammes(true),
    getCurriculumSummary(),
  ]);

  const live = programmes.filter((p) => !p.archivedAt);
  const archived = programmes.filter((p) => p.archivedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        description="The curriculum: what a swimmer works through, in the order they work through it."
        actions={<AddProgramme />}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{summary.programmes}</span>{" "}
        {summary.programmes === 1 ? "programme" : "programmes"}, holding{" "}
        <span className="font-medium text-foreground tabular-nums">{summary.levels}</span>{" "}
        {summary.levels === 1 ? "level" : "levels"} and{" "}
        <span className="font-medium text-foreground tabular-nums">{summary.competencies}</span>{" "}
        {summary.competencies === 1 ? "competency" : "competencies"} between them.
      </p>

      {live.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No programmes yet"
          hint="A programme is a ladder — Learn to Swim, Squad, Adult Lessons. Add one and give it levels."
          action={<AddProgramme />}
        />
      ) : (
        <ProgrammeTable programmes={live} />
      )}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Archived</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Not offered any more. Everything recorded against them is still readable.
          </p>
          <ProgrammeTable programmes={archived} archived />
        </section>
      ) : null}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof getProgrammes>>[number];

function ProgrammeTable({ programmes, archived }: { programmes: Row[]; archived?: boolean }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Programme
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Levels
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Enrolments
            </th>
            <th scope="col" className="w-32 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {programmes.map((programme, index) => (
            <tr
              key={programme.id}
              className="group border-b transition-colors last:border-0 hover:bg-accent/40"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                <Link
                  href={`/programmes/${programme.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {programme.name}
                </Link>
                {archived ? (
                  <Tag color="gray" className="ml-2">
                    Archived
                  </Tag>
                ) : null}
                {programme.description ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {programme.description}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                  {levelCountLabel(programme._count.levels)} ·{" "}
                  {programme._count.enrolments} enrolled
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                {programme._count.levels}
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                {programme._count.enrolments}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
