import Link from "next/link";
import { FollowUpHistory } from "./follow-up-history";
import { Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { FOLLOW_UP_META } from "@/lib/enrolment/constants";
import type { AwaitingMovesResult } from "@/lib/enrolment/data/awaiting-moves";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabel } from "@/lib/courses/constants";
import { formatDate } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { AwaitingNavigation } from "./awaiting-navigation";

export function AwaitingMoves({ result, enrol, profiles, courses }: {
  result: AwaitingMovesResult; enrol: boolean; profiles: boolean; courses: TransferTarget[];
}) {
  const { items, total, page, pages, q } = result;
  const pageHref = (number: number) => `/awaiting-enrolment?${new URLSearchParams({ view: "moves", ...(q ? { q } : {}), page: String(number) })}`;
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Awaiting enrolment" description="Arrange class places and follow up swimmers ready for their next class." />
    <AwaitingNavigation active="moves" />
    <form action="/awaiting-enrolment" className="flex flex-wrap items-end gap-3" role="search">
      <input type="hidden" name="view" value="moves" />
      <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
        <Label htmlFor="move-swimmer-search">Find a swimmer</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-ui-muted-foreground" />
          <Input id="move-swimmer-search" type="search" name="q" defaultValue={q} key={q} placeholder="Name or member number" maxLength={100} className="min-h-11 pl-9" />
        </div>
      </div>
      <Button type="submit" className="min-h-11">Search</Button>
      {q ? <Button asChild variant="ghost" className="min-h-11"><Link href="/awaiting-enrolment?view=moves">Clear</Link></Button> : null}
    </form>
    <div className="space-y-1"><h2 className="text-xl font-semibold">Awaiting moves</h2>
      <p className="text-sm" role="status">{total} {total === 1 ? "move" : "moves"}{q ? ` matching “${q}”` : ""}</p>
      <p className="text-sm text-ui-muted-foreground">Confirmed by instructors, oldest first. Swimmers stay in their current class until moved. Choose a destination at either site.</p>
    </div>
    {items.length ? <Table className="table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader><TableRow><TableHead scope="col">Swimmer & current class</TableHead><TableHead scope="col" className="hidden w-1/4 lg:table-cell">Family contact</TableHead><TableHead scope="col" className="hidden w-48 md:table-cell">Confirmed ready</TableHead></TableRow></TableHeader>
      <TableBody>{items.map(row => {
        const meta = FOLLOW_UP_META[row.reviewReason ? "reviewMove" : "readyToMove"];
        const label = `${courseLabel(row.course)} · ${row.course.club.name}`;
        const targets = courses.filter(course => course.id !== row.course.id);
        const confirmed = <><p>{row.readyToMoveByName ?? "Staff"}</p><p className="text-xs text-ui-muted-foreground">{formatDate(row.readyToMoveAt!)}</p></>;
        return <TableRow key={row.id}>
          <TableCell className="space-y-3 py-4">
            <div><div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {profiles ? <Link className="inline-flex min-h-11 items-center font-semibold text-ui-primary underline-offset-4 hover:underline" href={`/students/${row.student.id}`}>{fullName(row.student)}</Link> : <p className="font-semibold">{fullName(row.student)}</p>}
              <Tag color={meta.color}>{meta.label}</Tag>
            </div>{row.student.memberNumber ? <p className="text-xs text-ui-muted-foreground">{row.student.memberNumber}</p> : null}</div>
            <div><p className="font-medium">{label}</p><p className="text-sm text-ui-muted-foreground">{row.course.instructor?.name ?? "Instructor unassigned"}{row.course.location ? ` · ${row.course.location}` : ""}</p></div>
            <div className="text-sm"><p>{row.completedLevelName ? `${row.completedLevelName} completed` : "Level confirmation needs review"} · {row.programmeName}</p>
              {row.nextLevel ? <p className="text-ui-muted-foreground">Next level: {row.nextLevel.name}</p> : <p className="text-ui-muted-foreground">Choose the appropriate next class with the family.</p>}
              {row.readyToMoveNote ? <p className="mt-2 break-words">Instructor note: {row.readyToMoveNote}</p> : null}
            </div>
            {row.reviewReason ? <p className="text-sm text-ui-muted-foreground">{row.reviewReason}</p> : enrol ? <div className="[&_button]:min-h-11">
              <TransferEnrolment enrolment={{ id: row.id, status: row.status, student: row.student }} targets={targets} variant="button" classLabel={label} />
            </div> : null}
            <div className="mt-4"><FollowUpHistory studentId={row.student.id} name={fullName(row.student)} canRecord={enrol} summary={row.followUp} /></div>
            <div className="text-sm lg:hidden"><MoveContact student={row.student} /></div>
            <div className="text-sm md:hidden"><p className="font-medium">Confirmed ready</p>{confirmed}</div>
          </TableCell>
          <TableCell className="hidden break-words align-top py-6 lg:table-cell"><MoveContact student={row.student} /></TableCell>
          <TableCell className="hidden align-top py-6 md:table-cell">{confirmed}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table> : <EmptyState icon="users" title={q ? "No matching swimmers" : "No swimmers awaiting a move"} hint={q ? "Try another name or member number, or clear the search." : "Instructors add swimmers here by confirming Ready to move after every competency is achieved."} />}
    {pages > 1 ? <nav aria-label="Awaiting moves pages" className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-ui-muted-foreground">Page {page} of {pages}</span><div className="flex gap-2">
      {page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(page - 1)}>Previous</Link></Button> : null}
      {page < pages ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(page + 1)}>Next</Link></Button> : null}
    </div></nav> : null}
  </div>;
}

function MoveContact({ student }: { student: AwaitingMovesResult["items"][number]["student"] }) {
  return <div className="space-y-1 break-words">{student.contactName ? <p>{student.contactName}</p> : null}{student.contactPhone ? <p>{student.contactPhone}</p> : null}
    {student.contactEmail ? <p className="break-all text-ui-muted-foreground">{student.contactEmail}</p> : null}
    {!student.contactName && !student.contactPhone && !student.contactEmail ? <p className="text-ui-muted-foreground">No contact details recorded</p> : null}</div>;
}
