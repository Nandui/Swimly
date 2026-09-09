import { CurriculumImage } from "@/components/curriculum/curriculum-image";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { Link } from "@/components/workspace/typography";
import { HStack, VStack } from "@/components/workspace/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@/components/workspace/layout";
import { Heading, Text } from "@/components/workspace/typography";
import { VisuallyHidden } from "@/components/workspace/layout";
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
import { getCurriculumSummary, getProgrammes } from "@/lib/curriculum/data/curriculum";
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
    <VStack gap={6}>
      <PageHeader
        title="Programmes"
        description="The curriculum: what a swimmer works through, in the order they work through it."
        actions={<AddProgramme />}
      />

      <Lead>
        <Num>{summary.programmes}</Num> {summary.programmes === 1 ? "programme" : "programmes"},
        holding <Num>{summary.levels}</Num> {summary.levels === 1 ? "level" : "levels"} and{" "}
        <Num>{summary.competencies}</Num>{" "}
        {summary.competencies === 1 ? "competency" : "competencies"} between them.
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
        <VStack gap={3} as="section">
          <Heading level={2}>Archived</Heading>
          <Lead>Not offered any more. Everything recorded against them is still readable.</Lead>
          <ProgrammeTable programmes={archived} archived />
        </VStack>
      ) : null}
    </VStack>
  );
}

type Row = Awaited<ReturnType<typeof getProgrammes>>[number];

function ProgrammeTable({ programmes, archived }: { programmes: Row[]; archived?: boolean }) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Programme</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Levels
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Enrolments
          </TableHeaderCell>
          <TableHeaderCell scope="col">
            <VisuallyHidden>Actions</VisuallyHidden>
          </TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programmes.map((programme, index) => (
          <TableRow key={programme.id}>
            <TableCell>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <CurriculumImage kind="programme" id={programme.id} name={programme.name} />
                <Link href={`/programmes/${programme.id}`} weight="medium">
                  {programme.name}
                </Link>
                {archived ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
              </HStack>
              {programme.description ? (
                <Text type="supporting" display="block">
                  {programme.description}
                </Text>
              ) : null}
              <Text type="supporting" display="block" className="md:hidden">
                {levelCountLabel(programme._count.levels)} · {programme._count.enrolments} enrolled
              </Text>
            </TableCell>
            <TableCell className="max-md:hidden">
              <Text color="secondary" hasTabularNumbers>
                {programme._count.levels}
              </Text>
            </TableCell>
            <TableCell className="max-md:hidden">
              <Text color="secondary" hasTabularNumbers>
                {programme._count.enrolments}
              </Text>
            </TableCell>
            <TableCell>
              <HStack gap={1} vAlign="center" hAlign="end" wrap="wrap">
                {archived ? null : (
                  <MoveProgramme
                    programme={programme}
                    first={index === 0}
                    last={index === programmes.length - 1}
                  />
                )}
                <EditProgramme programme={programme} />
                <ArchiveProgramme programme={programme} />
              </HStack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
