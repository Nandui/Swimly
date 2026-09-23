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
import { EnrolInCourseForStudent, PromoteFromWaitlist } from "@/components/enrolment/enrolment-actions";
import { FOLLOW_UP_META } from "@/lib/enrolment/constants";
import type { AwaitingEnrolmentResult } from "@/lib/enrolment/data/awaiting-enrolment";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabel } from "@/lib/courses/constants";
import { formatDate } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { AwaitingNavigation } from "./awaiting-navigation";

type QueueItem = AwaitingEnrolmentResult["items"][number];

export function AwaitingEnrolment({ result, enrol, profiles, assessments, courses }: {
  result: AwaitingEnrolmentResult; enrol: boolean; profiles: boolean; assessments: boolean; courses: TransferTarget[];
}) {
  const { items, total, page, pages, q } = result;
  const pageHref = (number: number) => `/awaiting-enrolment?${new URLSearchParams({ ...(q ? { q } : {}), page: String(number) })}`;
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Awaiting enrolment" description="Assessed swimmers awaiting a place and class waitlists at this site. Follow up with families and arrange their next class." />
    <AwaitingNavigation active="enrolment" />
    <form action="/awaiting-enrolment" className="flex flex-wrap items-end gap-3" role="search">
      <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
        <Label htmlFor="awaiting-swimmer-search">Find a swimmer</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-ui-muted-foreground" />
          <Input id="awaiting-swimmer-search" type="search" name="q" defaultValue={q} key={q} placeholder="Name or member number" maxLength={100} className="min-h-11 pl-9" />
        </div>
      </div>
      <Button type="submit" className="min-h-11">Search</Button>
      {q ? <Button asChild variant="ghost" className="min-h-11"><Link href="/awaiting-enrolment">Clear</Link></Button> : null}
    </form>
    <div className="space-y-1">
      <p className="text-sm font-medium" role="status">{total} {total === 1 ? "follow-up" : "follow-ups"}{q ? ` matching “${q}”` : ""}</p>
      <p className="text-sm text-ui-muted-foreground">Oldest first, grouped by swimmer and programme. Waitlists stay visible even when a swimmer already has another class.</p>
    </div>
    {items.length ? <Table className="table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader><TableRow>
        <TableHead scope="col">Swimmer & next class</TableHead>
        <TableHead scope="col" className="hidden w-1/4 lg:table-cell">Family contact</TableHead>
        <TableHead scope="col" className="hidden w-36 md:table-cell">Waiting since</TableHead>
      </TableRow></TableHeader>
      <TableBody>{items.map(row => {
        const meta = FOLLOW_UP_META[row.waitlists.length ? "waitlisted" : "awaiting"];
        const options = courses.filter(course => course.level.id === row.outcomeLevel?.id && !row.waitlists.some(waiting => waiting.course.id === course.id));
        return <TableRow key={row.id}>
          <TableCell className="py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {profiles ? <Link className="inline-flex min-h-11 items-center font-semibold text-ui-primary underline-offset-4 hover:underline" href={`/students/${row.student.id}`}>{fullName(row.student)}</Link> : <p className="font-semibold">{fullName(row.student)}</p>}
              <Tag color={meta.color}>{meta.label}</Tag>
            </div>
            {row.student.memberNumber ? <p className="text-xs text-ui-muted-foreground">{row.student.memberNumber}</p> : null}
            <p className="mt-1 text-sm text-ui-muted-foreground">{row.programme.name}</p>
            {row.outcomeLevel ? <div className="mt-2 text-sm">
              <p className="font-medium">Assessed level: {row.outcomeLevel.name}</p>
              <AssessmentDate row={row} linked={assessments} />
            </div> : null}
            {row.waitlists.length ? <ul className="mt-3 space-y-3" aria-label={`Class waitlists for ${fullName(row.student)}`}>
              {row.waitlists.map(waiting => {
                const full = waiting.course.capacity !== null && waiting.course._count.enrolments >= waiting.course.capacity;
                const label = courseLabel(waiting.course);
                return <li key={waiting.id} className="space-y-1 border-l-2 border-ui-border pl-3">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-ui-muted-foreground">Waitlisted {formatDate(waiting.createdAt)}{waiting.course.archivedAt ? " · Class archived" : full ? " · Class full" : " · Space available"}</p>
                  {enrol && !full && !waiting.course.archivedAt ? <div className="pt-1 [&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal">
                    <PromoteFromWaitlist enrolment={{ id: waiting.id, status: "WAITLISTED", student: { firstName: row.student.firstName, lastName: row.student.lastName } }} variant="button" classLabel={label} />
                  </div> : null}
                </li>;
              })}
            </ul> : null}
            {enrol && row.outcomeLevel ? <div className="mt-3 [&_button]:min-h-11">
              {options.length ? <EnrolInCourseForStudent student={{ id: row.student.id, firstName: row.student.firstName, lastName: row.student.lastName }} courses={options} label={row.waitlists.length ? "Choose another class" : "Enrol"} />
                : !row.waitlists.length ? <p className="text-sm text-ui-muted-foreground">No classes set up at this level</p> : null}
            </div> : null}
            <div className="mt-4"><FollowUpHistory studentId={row.student.id} name={fullName(row.student)} canRecord={enrol} summary={row.followUp} /></div>
            <div className="mt-3 text-sm lg:hidden"><Contact student={row.student} /></div>
            <p className="mt-2 text-xs text-ui-muted-foreground md:hidden">Waiting since {formatDate(row.queuedOn)}</p>
          </TableCell>
          <TableCell className="hidden break-words align-top py-6 lg:table-cell"><Contact student={row.student} /></TableCell>
          <TableCell className="hidden align-top py-6 md:table-cell">{formatDate(row.queuedOn)}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table> : <EmptyState icon="users" title={q ? "No matching swimmers" : "No swimmers awaiting enrolment"}
      hint={q ? "Try another name or member number, or clear the search." : "Swimmers appear here after an assessment placement or when added to a class waitlist at this site."} />}
    {pages > 1 ? <nav aria-label="Awaiting enrolment pages" className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-ui-muted-foreground">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(page - 1)}>Previous</Link></Button> : null}
        {page < pages ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(page + 1)}>Next</Link></Button> : null}
      </div>
    </nav> : null}
  </div>;
}

function AssessmentDate({ row, linked }: { row: QueueItem; linked: boolean }) {
  if (!row.assessedOn || !row.session) return null;
  const text = `Assessed ${formatDate(row.assessedOn)}`;
  return linked ? <Link href={`/assessments/${row.session.id}`} className="inline-flex min-h-11 items-center text-ui-primary underline-offset-4 hover:underline">{text}</Link> : <p className="text-ui-muted-foreground">{text}</p>;
}

function Contact({ student }: { student: QueueItem["student"] }) {
  return <div className="space-y-1 break-words">
    {student.contactName ? <p>{student.contactName}</p> : null}
    {student.contactPhone ? <p>{student.contactPhone}</p> : null}
    {student.contactEmail ? <p className="break-all text-ui-muted-foreground">{student.contactEmail}</p> : null}
    {!student.contactName && !student.contactPhone && !student.contactEmail ? <p className="text-ui-muted-foreground">No contact details recorded</p> : null}
  </div>;
}
