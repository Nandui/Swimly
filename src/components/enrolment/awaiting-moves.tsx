import Link from "next/link";
import { FollowUpHistory } from "./follow-up-history";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { FOLLOW_UP_META } from "@/lib/enrolment/constants";
import type { AwaitingMovesResult } from "@/lib/enrolment/data/awaiting-moves";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabel } from "@/lib/courses/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { AwaitingQueue, QueueContact, QueueList, QueuePagination, QueueRow } from "./awaiting-queue";

export function AwaitingMoves({ result, enrol, profiles, courses }: {
  result: AwaitingMovesResult; enrol: boolean; profiles: boolean; courses: TransferTarget[];
}) {
  const { items, total, page, pages, q } = result;
  return <AwaitingQueue view="moves" total={total} q={q}>
    {items.length ? <QueueList>{items.map(row => {
      const meta = FOLLOW_UP_META[row.reviewReason ? "reviewMove" : "readyToMove"];
      const name = fullName(row.student);
      const label = `${courseLabel(row.course)} · ${row.course.club.name}`;
      const targets = courses.filter(course => course.id !== row.course.id);
      return <QueueRow key={row.id} name={name} contactSummary={row.followUp} description={`${row.programmeName}${row.nextLevel ? ` · Next: ${row.nextLevel.name}` : ""}`} status={<Tag color={meta.color}>{meta.label}</Tag>} nextContact={row.followUp?.latest?.nextContactOn ? `${row.followUp.latest.nextContactOn < today() ? "Follow-up overdue" : "Follow up"} · ${formatDate(parseDateOnly(row.followUp.latest.nextContactOn))}` : undefined} identity={<>
        <div>{profiles ? <Link className="inline-flex min-h-11 items-center rounded-ui-sm font-semibold text-ui-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2" href={`/students/${row.student.id}`}>{name}</Link> : <p className="font-semibold">{name}</p>}
          {row.student.memberNumber && <p className="break-all text-xs text-ui-muted-foreground">{row.student.memberNumber}</p>}
        </div>
        <div className="text-xs text-ui-muted-foreground"><p>Confirmed ready {formatDate(row.readyToMoveAt!)}</p><p>By {row.readyToMoveByName ?? "Staff"}</p></div>
        <QueueContact student={row.student} />
      </>} placement={<>
        <div><p className="text-xs text-ui-muted-foreground">Current class</p><p className="mt-1 font-medium">{label}</p><p className="text-xs text-ui-muted-foreground">{row.course.instructor?.name ?? "Instructor unassigned"}{row.course.location ? ` · ${row.course.location}` : ""}</p></div>
        <div><p>{row.completedLevelName ? `${row.completedLevelName} completed` : "Level confirmation needs review"} · {row.programmeName}</p>
          {row.nextLevel ? <p className="mt-1 font-medium">Next level: {row.nextLevel.name}</p> : <p className="text-ui-muted-foreground">Choose the appropriate next class with the family.</p>}
        </div>
        {row.readyToMoveNote && <p className="break-words text-sm text-ui-muted-foreground">Instructor note: {row.readyToMoveNote}</p>}
        {row.reviewReason ? <p className="rounded-ui-md bg-ui-muted p-3 text-sm">{row.reviewReason}</p> : enrol ? <div className="[&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal">
          <TransferEnrolment enrolment={{ id: row.id, status: row.status, student: row.student }} targets={targets} variant="button" classLabel={label} />
        </div> : null}
      </>} followUp={<FollowUpHistory studentId={row.student.id} name={name} canRecord={enrol} summary={row.followUp} presentation="queue" />} />;
    })}</QueueList> : <EmptyState icon="users" title={q ? "No matching swimmers" : "No swimmers awaiting a move"} hint={q ? "Try another name or member number, or clear the search." : "Instructors add swimmers here by confirming Ready to move after every competency is achieved."} />}
    <QueuePagination page={page} pages={pages} q={q} moves />
  </AwaitingQueue>;
}
