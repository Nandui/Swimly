import Link from "next/link";
import { FollowUpHistory } from "@/modules/activities/shared/enrolment/components/follow-up-history";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { EnrolInCourseForStudent, PromoteFromWaitlist } from "@/modules/activities/shared/enrolment/components/enrolment-actions";
import { FOLLOW_UP_META, WAITLIST_AVAILABILITY_META } from "@/modules/activities/shared/enrolment/constants";
import type { AwaitingEnrolmentResult } from "@/modules/activities/features/enrolment/server/data/awaiting-enrolment";
import type { TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import { courseLabel } from "@/modules/activities/shared/courses/constants";
import { ClipboardCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { fullName } from "@/modules/activities/shared/students/constants";
import { AwaitingQueue, QueueContact, QueueList, QueueRow } from "@/modules/activities/features/enrolment/components/awaiting-queue";

type QueueItem = AwaitingEnrolmentResult["items"][number];

export function AwaitingEnrolment({ result, enrol, profiles, assessments, courses, counts }: {
  result: AwaitingEnrolmentResult; enrol: boolean; profiles: boolean; assessments: boolean; courses: TransferTarget[]; counts?: { enrolment: number; moves: number };
}) {
  const { items, total, page, pageSize, q } = result;
  return <AwaitingQueue view="enrolment" total={total} q={q} counts={counts} page={page} pageSize={pageSize}>
    {items.length ? <QueueList>{items.map(row => {
      const meta = FOLLOW_UP_META[row.waitlists.length ? "waitlisted" : "awaiting"];
      const name = fullName(row.student);
      const options = courses.filter(course => course.level.id === row.outcomeLevel?.id && !row.waitlists.some(waiting => waiting.course.id === course.id));
      return <QueueRow key={row.id} name={name} contactSummary={row.followUp} description={`${row.programme.name}${row.outcomeLevel ? ` · ${row.outcomeLevel.name}` : ""}`} status={<Tag meta={meta} />} nextContactOn={row.followUp?.latest?.nextContactOn ?? undefined} identity={<>
        <div>
          {profiles ? <Link className="inline-flex min-h-11 items-center rounded-ui-sm font-semibold text-ui-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2" href={`/students/${row.student.id}`}>{name}</Link> : <p className="font-semibold">{name}</p>}
          {row.student.memberNumber && <p className="break-all text-xs text-ui-muted-foreground">{row.student.memberNumber}</p>}
        </div>
        <p className="text-xs text-ui-muted-foreground">Waiting since {formatDate(row.queuedOn)}</p>
        <QueueContact student={row.student} />
      </>} placement={<>
        <div className="min-w-0 flex gap-3 items-start rounded-ui-lg border border-ui-border p-4"><span className="pc-tile-icon" aria-hidden="true"><ClipboardCheck /></span><div className="min-w-0"><p className="font-semibold">{row.programme.name}{row.outcomeLevel ? ` · ${row.outcomeLevel.name}` : ""}</p>
          {row.outcomeLevel && <><p className="text-xs text-ui-muted-foreground">Assessed level</p><AssessmentDate row={row} linked={assessments} /></>}
        </div></div>
        {row.waitlists.length > 0 && <ul className="flex flex-col gap-3" aria-label={`Class waitlists for ${name}`}>
          {row.waitlists.map(waiting => {
            const full = waiting.course.capacity !== null && waiting.course._count.enrolments >= waiting.course.capacity;
            const availability = WAITLIST_AVAILABILITY_META[waiting.course.archivedAt ? "archived" : full ? "full" : "available"];
            const label = courseLabel(waiting.course);
            return <li key={waiting.id} className="min-w-0 flex flex-col gap-2 rounded-ui-lg border border-ui-border p-4">
              <p className="font-semibold">{label}</p>
              <div className="flex flex-wrap items-center gap-2"><Tag meta={availability} /><span className="text-xs text-ui-muted-foreground">Waitlisted {formatDate(waiting.createdAt)}</span></div>
              {enrol && !full && !waiting.course.archivedAt && <div className="[&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal">
                <PromoteFromWaitlist enrolment={{ id: waiting.id, status: "WAITLISTED", student: { firstName: row.student.firstName, lastName: row.student.lastName } }} classLabel={label} />
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
  </AwaitingQueue>;
}

function AssessmentDate({ row, linked }: { row: QueueItem; linked: boolean }) {
  if (!row.assessedOn || !row.session) return null;
  const text = `Assessed ${formatDate(row.assessedOn)}`;
  return linked ? <Link href={`/assessments/${row.session.id}`} className="inline-flex min-h-11 items-center rounded-ui-sm text-xs text-ui-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2">{text}</Link> : <p className="text-xs text-ui-muted-foreground">{text}</p>;
}
