import Link from "next/link";
import { FollowUpHistory } from "./follow-up-history";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { EnrolInCourseForStudent, PromoteFromWaitlist } from "@/components/enrolment/enrolment-actions";
import { FOLLOW_UP_META, WAITLIST_AVAILABILITY_META } from "@/lib/enrolment/constants";
import type { AwaitingEnrolmentResult } from "@/lib/enrolment/data/awaiting-enrolment";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabel } from "@/lib/courses/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { AwaitingQueue, QueueContact, QueueList, QueuePagination, QueueRow } from "./awaiting-queue";

type QueueItem = AwaitingEnrolmentResult["items"][number];

export function AwaitingEnrolment({ result, enrol, profiles, assessments, courses }: {
  result: AwaitingEnrolmentResult; enrol: boolean; profiles: boolean; assessments: boolean; courses: TransferTarget[];
}) {
  const { items, total, page, pages, q } = result;
  return <AwaitingQueue view="enrolment" total={total} q={q}>
    {items.length ? <QueueList>{items.map(row => {
      const meta = FOLLOW_UP_META[row.waitlists.length ? "waitlisted" : "awaiting"];
      const name = fullName(row.student);
      const options = courses.filter(course => course.level.id === row.outcomeLevel?.id && !row.waitlists.some(waiting => waiting.course.id === course.id));
      return <QueueRow key={row.id} name={name} contactSummary={row.followUp} description={`${row.programme.name}${row.outcomeLevel ? ` · ${row.outcomeLevel.name}` : ""}`} status={<Tag color={meta.color}>{meta.label}</Tag>} nextContact={row.followUp?.latest?.nextContactOn ? `${row.followUp.latest.nextContactOn < today() ? "Follow-up overdue" : "Follow up"} · ${formatDate(parseDateOnly(row.followUp.latest.nextContactOn))}` : undefined} identity={<>
        <div>
          {profiles ? <Link className="inline-flex min-h-11 items-center rounded-ui-sm font-semibold text-ui-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2" href={`/students/${row.student.id}`}>{name}</Link> : <p className="font-semibold">{name}</p>}
          {row.student.memberNumber && <p className="break-all text-xs text-ui-muted-foreground">{row.student.memberNumber}</p>}
        </div>
        <p className="text-xs text-ui-muted-foreground">Waiting since {formatDate(row.queuedOn)}</p>
        <QueueContact student={row.student} />
      </>} placement={<>
        <div><p className="font-medium">{row.programme.name}</p>
          {row.outcomeLevel && <><p className="mt-1">Assessed level: {row.outcomeLevel.name}</p><AssessmentDate row={row} linked={assessments} /></>}
        </div>
        {row.waitlists.length > 0 && <ul className="space-y-3" aria-label={`Class waitlists for ${name}`}>
          {row.waitlists.map(waiting => {
            const full = waiting.course.capacity !== null && waiting.course._count.enrolments >= waiting.course.capacity;
            const availability = WAITLIST_AVAILABILITY_META[waiting.course.archivedAt ? "archived" : full ? "full" : "available"];
            const label = courseLabel(waiting.course);
            return <li key={waiting.id} className="space-y-2 border-t border-ui-border pt-3">
              <p className="font-medium">{label}</p>
              <div className="flex flex-wrap items-center gap-2"><Tag color={availability.color}>{availability.label}</Tag><span className="text-xs text-ui-muted-foreground">Waitlisted {formatDate(waiting.createdAt)}</span></div>
              {enrol && !full && !waiting.course.archivedAt && <div className="[&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal">
                <PromoteFromWaitlist enrolment={{ id: waiting.id, status: "WAITLISTED", student: { firstName: row.student.firstName, lastName: row.student.lastName } }} variant="button" classLabel={label} />
              </div>}
            </li>;
          })}
        </ul>}
        {enrol && row.outcomeLevel && <div className="[&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal">
          {options.length ? <EnrolInCourseForStudent student={{ id: row.student.id, firstName: row.student.firstName, lastName: row.student.lastName }} courses={options} variant={row.waitlists.length ? "outline" : "default"} label={row.waitlists.length ? "Choose another class" : "Find a class"} />
            : !row.waitlists.length ? <p className="text-sm text-ui-muted-foreground">No classes set up at this level. Record what the family needs in a follow-up.</p> : null}
        </div>}
      </>} followUp={<FollowUpHistory studentId={row.student.id} name={name} canRecord={enrol} summary={row.followUp} presentation="queue" />} />;
    })}</QueueList> : <EmptyState icon="users" title={q ? "No matching swimmers" : "No swimmers awaiting enrolment"}
      hint={q ? "Try another name or member number, or clear the search." : "Swimmers appear here after an assessment placement or when added to a class waitlist at this site."} />}
    <QueuePagination page={page} pages={pages} q={q} />
  </AwaitingQueue>;
}

function AssessmentDate({ row, linked }: { row: QueueItem; linked: boolean }) {
  if (!row.assessedOn || !row.session) return null;
  const text = `Assessed ${formatDate(row.assessedOn)}`;
  return linked ? <Link href={`/assessments/${row.session.id}`} className="inline-flex min-h-11 items-center rounded-ui-sm text-xs text-ui-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2">{text}</Link> : <p className="text-xs text-ui-muted-foreground">{text}</p>;
}
