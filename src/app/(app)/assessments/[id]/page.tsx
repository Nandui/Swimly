import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  BookOntoSession,
  CancelBooking,
  MarkNoShow,
  RecordOutcome,
} from "@/components/assessments/booking-actions";
import { CancelSession, EditSession } from "@/components/assessments/session-actions";
import { BOOKING_STATUS_META, HOLDS_A_PLACE, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import {
  getAssessmentProgrammeOptions,
  getAssessmentSession,
  type BookingRow,
  type SessionDetail,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { getInstructorOptions } from "@/lib/courses/data/courses";
import { formatDate, today } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { ageLabel, fullName } from "@/lib/students/constants";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentSessionPage(props: PageProps<"/assessments/[id]">) {
  const auth = await pageSession();
  const book = can(auth, "enrolment.manage");
  const assess = can(auth, "progression.assess");
  const manage = can(auth, "courses.manage");
  const { id } = await props.params;

  const [session, programmes, instructors] = await Promise.all([
    getAssessmentSession(id),
    manage ? getAssessmentProgrammeOptions() : Promise.resolve([]),
    manage ? getInstructorOptions() : Promise.resolve([]),
  ]);
  if (!session) notFound();

  const holding = session.bookings.filter((b) => HOLDS_A_PLACE.includes(b.status));
  const gone = session.bookings.filter((b) => !HOLDS_A_PLACE.includes(b.status));
  const taken = holding.length;
  const full = session.capacity !== null && taken >= session.capacity;
  const placed = holding.filter((b) => b.outcomeLevel).length;
  const open = !session.cancelledAt;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/assessments"
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Assessments
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {sessionDay(session)}
              {session.cancelledAt ? <Tag color="gray">Cancelled</Tag> : null}
              {open && full ? <Tag color="yellow">Full</Tag> : null}
            </span>
          }
          description={
            `${sessionSpan(session)} · ${session.programme.name}` +
            (session.location ? ` · ${session.location}` : "") +
            (session.instructor ? ` · ${session.instructor.name}` : " · assessor not decided")
          }
          actions={
            <>
              {book && open ? <BookOntoSession session={session} taken={taken} /> : null}
              {manage && open ? (
                <>
                  <EditSession
                    session={session}
                    programmes={programmes}
                    instructors={instructors}
                    today={today()}
                    variant="button"
                  />
                  <CancelSession session={session} />
                </>
              ) : null}
            </>
          }
        />
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {session.capacity === null ? `${taken} booked` : `${taken} of ${session.capacity}`}
        </span>{" "}
        {session.capacity === null ? "" : "places taken"}
        {taken > 0 ? (
          <>
            , <span className="font-medium text-foreground tabular-nums">{placed}</span> placed so far
          </>
        ) : null}
        .{session.notes ? ` ${session.notes}` : ""}
      </p>

      {session.bookings.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody booked yet"
          hint="Book a swimmer and they appear here. Once they have been in the water, place them at the level they belong at."
          action={book && open ? <BookOntoSession session={session} taken={0} /> : null}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Booked</h2>
            {holding.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody is holding a place.</p>
            ) : (
              <BookingTable entries={holding} session={session} book={book} assess={assess} />
            )}
          </section>

          {gone.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Not coming</h2>
              <BookingTable entries={gone} session={session} book={book} assess={assess} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BookingTable({
  entries,
  session,
  book,
  assess,
}: {
  entries: BookingRow[];
  session: SessionDetail;
  book: boolean;
  assess: boolean;
}) {
  const open = !session.cancelledAt;
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Swimmer
            </th>
            <th scope="col" className="w-12 px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden">
              Age
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Placed at
            </th>
            <th scope="col" className="w-28 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <tr key={b.id} className="group border-b transition-colors last:border-0 hover:bg-accent/40">
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link href={`/students/${b.student.id}`} className="underline-offset-2 hover:underline">
                    {fullName(b.student)}
                  </Link>
                  {b.student.medicalNotes ? (
                    <Tag color="red" className="ml-2">
                      Medical
                    </Tag>
                  ) : null}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    <span className="md:hidden">{ageLabel(b.student.dateOfBirth)} · </span>
                    booked by {b.bookedByName}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                  {ageLabel(b.student.dateOfBirth)}
                </td>
                <td className="px-3 py-2">
                  <Tag color={meta.color}>{meta.label}</Tag>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {b.outcomeLevel ? (
                    <>
                      <span className="font-medium text-foreground">{b.outcomeLevel.name}</span>
                      {b.outcomeNote ? (
                        <span className="mt-0.5 block text-xs">{b.outcomeNote}</span>
                      ) : null}
                      <span className="mt-0.5 block text-xs">
                        {b.assessedByName}
                        {b.assessedOn ? `, ${formatDate(b.assessedOn)}` : ""}
                      </span>
                    </>
                  ) : b.status === "BOOKED" ? (
                    <span className="text-xs">Not yet</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                    {assess && open && (b.status === "BOOKED" || b.status === "ATTENDED") ? (
                      <RecordOutcome booking={b} session={session} />
                    ) : null}
                    {assess && open && b.status === "BOOKED" ? <MarkNoShow booking={b} /> : null}
                    {book && open && b.status === "BOOKED" ? (
                      <CancelBooking booking={b} session={session} />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
