import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, parseDateOnly } from "@/lib/format";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { cellTone, MATRIX_CELL_META, trainingMatrix, type MatrixCell } from "@/modules/training/features/compliance";

export const metadata: Metadata = { title: "Training matrix" };

const short = (iso: string) => formatDate(parseDateOnly(iso));
function cellLabel(cell: MatrixCell) {
  switch (cell.kind) {
    case "done": return cell.dueAgain ? `Done · again ${short(cell.dueAgain)}` : `Done ${short(cell.on)}`;
    case "due": return cell.submitted ? "Awaiting sign-off" : cell.on ? `${cell.overdue ? "Overdue" : "Due"} ${short(cell.on)}` : "To do";
    case "expired": return `Ran out ${short(cell.on)}`;
    default: return undefined;
  }
}

/** The training matrix (e-learning phase 4): for the people this person covers, every course a
 *  training rule says they need and where they stand on it, with how many are in date. Filtered by
 *  site, department or course, and downloaded for Excel. */
export default async function TrainingMatrixPage({ searchParams }: { searchParams: Promise<{ site?: string; department?: string; course?: string }> }) {
  const input = await searchParams;
  const filters = { site: input.site || undefined, department: input.department || undefined, course: input.course || undefined };
  const { columns, rows, sites, departments, allCourses, summary } = await trainingMatrix(filters);
  const filtered = !!(filters.site || filters.department || filters.course);
  const query = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();
  return (
    <PageShell header={<PageHeader title="Training matrix" description="Everyone you cover against the courses training rules say they need."
        actions={rows.length ? <Button asChild variant="outline" className="min-h-11"><a href={`/training/matrix/export${query ? `?${query}` : ""}`} download><Download aria-hidden="true" />Download for Excel</a></Button> : null} />}>
      <form method="get" className="pc-panel" role="search" aria-label="Filter the training matrix">
        <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52"><Label htmlFor="matrix-site" className="block">Site</Label>
          <NativeSelect id="matrix-site" name="site" defaultValue={input.site ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Every site</NativeSelectOption>
            {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52"><Label htmlFor="matrix-department" className="block">Department</Label>
          <NativeSelect id="matrix-department" name="department" defaultValue={input.department ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Every department</NativeSelectOption>
            {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52"><Label htmlFor="matrix-course" className="block">Course</Label>
          <NativeSelect id="matrix-course" name="course" defaultValue={input.course ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Every course with a rule</NativeSelectOption>
            {allCourses.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="min-h-11">Apply filters</Button>
          {filtered ? <Button asChild variant="ghost" className="min-h-11"><Link href="/training/matrix">Reset</Link></Button> : null}
        </div>
        </div>
      </form>

      {!allCourses.length ? (
        <EmptyState as="h2" icon="graduation" title="No courses are required yet" hint="Add training rules to say who needs which course. They show here once they do." />
      ) : !rows.length ? (
        <EmptyState as="h2" icon="graduation" title="Nobody here" hint={filtered ? "No one you cover matches these filters and needs these courses." : "The training rules cover nobody you cover."} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="How many are in date">
            <div className="pc-panel"><p className="text-sm text-ui-muted-foreground">In date</p><p className="text-3xl font-semibold tabular-nums">{summary.percent}%</p></div>
            <div className="pc-panel"><p className="text-sm text-ui-muted-foreground">Courses done and in date</p><p className="text-3xl font-semibold tabular-nums">{summary.compliant} of {summary.needed}</p></div>
            <div className="pc-panel"><p className="text-sm text-ui-muted-foreground">People</p><p className="text-3xl font-semibold tabular-nums">{rows.length}</p></div>
          </section>
          <section className="pc-panel p-0" aria-label="Training matrix">
            <Table>
              <TableCaption className="sr-only">Each person, and where they stand on each course a rule says they need</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="sticky left-0 z-10 bg-ui-card p-3">Person</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.id} scope="col" className="h-auto min-w-40 p-3 align-bottom whitespace-normal">
                      <Link href={`/training/courses/${c.id}`} className="underline-offset-4 hover:underline">{c.title}</Link>
                      <span className="block text-xs font-normal text-ui-muted-foreground tabular-nums">{c.needed ? `${c.compliant} of ${c.needed} in date` : "Nobody here"}{c.paused ? " · rule paused" : ""}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableHead scope="row" className="sticky left-0 z-10 h-auto bg-ui-card p-3 font-medium">
                      <Link href={`/training/people/${row.id}`} className="underline-offset-4 hover:underline">{row.name}</Link>
                      <span className="block text-xs font-normal text-ui-muted-foreground tabular-nums">{row.compliant} of {row.needed}</span>
                    </TableHead>
                    {row.cells.map((cell, i) => (
                      <TableCell key={columns[i].id} className="p-3">
                        {cell ? <Tag meta={MATRIX_CELL_META[cellTone(cell)]} label={cellLabel(cell)} /> : <span className="text-ui-muted-foreground" aria-label="Not needed">–</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </PageShell>
  );
}
