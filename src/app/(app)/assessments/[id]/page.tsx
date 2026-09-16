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

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import {
  BookOntoSession,
  CancelBooking,
  MarkNoShow,
  RecordOutcome,
} from "@/components/assessments/booking-actions";
import { AssessmentNav } from "@/components/assessments/assessment-nav";
import { Button } from "@/components/shadcn/button";
import { WrongClub } from "@/components/clubs/wrong-club";
import {
  SESSION_STATUS_META,
  BOOKING_STATUS_META,
  HOLDS_A_PLACE,
  isPast,
  sessionDay,
  sessionSpan,
} from "@/lib/assessments/constants";
import {
  getAssessmentSession,
  type BookingRow,
  type SessionDetail,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { formatDate, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import {
  MEDICAL_STATUS_META,
  ageLabel,
  fullName,
} from "@/lib/students/constants";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentSessionPage(
  props: PageProps<"/assessments/[id]">,
) {
  const auth = await screenPage("assessments");
  const book = can(auth, "enrolment.manage");
  const assess = can(auth, "assessments.run");
  const manage = can(auth, "courses.manage");
  const { id } = await props.params;

  const [session, { club }] = await Promise.all(
    [
      getAssessmentSession(id),
      getCurrentClub(),
    ],
  );
  if (!session) notFound();
  if (session.clubId !== club.id) {
    return (
      <WrongClub
        what={`The assessment session on ${sessionDay(session)}`}
        owner={session.club}
        current={club}
      />
    );
  }

  const holding = session.bookings.filter((b) =>
    HOLDS_A_PLACE.includes(b.status),
  );
  const gone = session.bookings.filter(
    (b) => !HOLDS_A_PLACE.includes(b.status),
  );
  const taken = holding.length;
  const full = session.capacity !== null && taken >= session.capacity;
  const placed = holding.filter((b) => b.outcomeLevel).length;
  const open = !session.cancelledAt;

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <div className="min-w-0 flex flex-col gap-2">
        <BackLink href={isPast(session, today()) ? "/assessments?view=past" : "/assessments"} current={sessionDay(session)}>
          Assessments
        </BackLink>
        <PageHeader
          title={
            <div className="min-w-0 flex gap-2 items-center flex-wrap">
              {sessionDay(session)}
              {session.cancelledAt ? (
                <Tag color={SESSION_STATUS_META.cancelled.color}>
                  {SESSION_STATUS_META.cancelled.label}
                </Tag>
              ) : null}
              {open && full ? (
                <Tag color={SESSION_STATUS_META.full.color}>
                  {SESSION_STATUS_META.full.label}
                </Tag>
              ) : null}
            </div>
          }
          description={
            `${sessionSpan(session)} · ${session.programme.name} · ${session.type?.name ?? "kind not set"}` +
            (session.location ? ` · ${session.location}` : "") +
            (session.instructor
              ? ` · ${session.instructor.name}`
              : " · assessor not decided")
          }
          actions={
            <>
              {book && open ? (
                <BookOntoSession session={session} taken={taken} />
              ) : null}
              {manage ? <Button asChild variant="outline" className="min-h-11"><UiLink href={`/assessments/${id}/setup`}>Session setup</UiLink></Button> : null}
            </>
          }
        />
      </div>

      <AssessmentNav active="upcoming" manage={manage} />

      <Lead>
        <Num>
          {session.capacity === null
            ? `${taken} booked`
            : `${taken} of ${session.capacity}`}
        </Num>{" "}
        {session.capacity === null ? "" : "places taken"}
        {taken > 0 ? (
          <>
            , <Num>{placed}</Num> placed so far
          </>
        ) : null}
        .{session.notes ? ` ${session.notes}` : ""}
      </Lead>

      {session.bookings.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nobody booked yet"
          hint="Book a swimmer and they appear here. Once they have been in the water, place them at the level they belong at."
          action={
            book && open ? (
              <BookOntoSession session={session} taken={0} />
            ) : null
          }
        />
      ) : (
        <div className="min-w-0 flex flex-col gap-6">
          <section className="min-w-0 flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Booked</h2>
            {holding.length === 0 ? (
              <p className="text-sm text-ui-muted-foreground block">
                Nobody is holding a place.
              </p>
            ) : (
              <BookingTable
                entries={holding}
                session={session}
                book={book}
                assess={assess}
              />
            )}
          </section>

          {gone.length > 0 ? (
            <section className="min-w-0 flex flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">
                Not coming
              </h2>
              <BookingTable
                entries={gone}
                session={session}
                book={book}
                assess={assess}
              />
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
  const actions = open && (book || assess);
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Swimmer</TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Age
          </TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Placed at
          </TableHead>
          {actions ? (
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((b) => {
          const meta = BOOKING_STATUS_META[b.status];
          return (
            <TableRow key={b.id}>
              <TableCell>
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  <UiLink
                    href={`/students/${b.student.id}`}
                    className={
                      "text-ui-foreground underline-offset-4 hover:underline font-medium"
                    }
                  >
                    {fullName(b.student)}
                  </UiLink>
                  {b.student.medicalNotes ? (
                    <Tag color={MEDICAL_STATUS_META.notes.color}>
                      {MEDICAL_STATUS_META.notes.label}
                    </Tag>
                  ) : null}
                </div>
                <span className="text-sm text-ui-muted-foreground block">
                  <span
                    className={cn(
                      "text-sm text-ui-muted-foreground",
                      "md:hidden",
                    )}
                  >
                    {ageLabel(b.student.dateOfBirth)} ·{" "}
                  </span>
                  booked by {b.bookedByName}
                </span>
                {/* The placement column leaves the table on a phone and
                    re-homes here, so the row stays one screen wide. */}
                {b.outcomeLevel ? (
                  <span
                    className={cn(
                      "text-sm text-ui-muted-foreground block",
                      "md:hidden",
                    )}
                  >
                    Placed at{" "}
                    <span className="text-sm text-ui-foreground font-medium">
                      {b.outcomeLevel.name}
                    </span>
                    {b.assessedByName ? ` by ${b.assessedByName}` : ""}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className={"max-md:hidden"}>
                <span className="text-sm text-ui-muted-foreground tabular-nums">
                  {ageLabel(b.student.dateOfBirth)}
                </span>
              </TableCell>
              <TableCell>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              <TableCell className={"max-md:hidden"}>
                {b.outcomeLevel ? (
                  <>
                    <span className="text-sm text-ui-foreground font-medium">
                      {b.outcomeLevel.name}
                    </span>
                    {b.outcomeNote ? (
                      <span className="text-sm text-ui-muted-foreground block">
                        {b.outcomeNote}
                      </span>
                    ) : null}
                    <span className="text-sm text-ui-muted-foreground block">
                      {b.assessedByName}
                      {b.assessedOn ? `, ${formatDate(b.assessedOn)}` : ""}
                    </span>
                  </>
                ) : b.status === "BOOKED" ? (
                  <span className="text-sm text-ui-muted-foreground">
                    Not yet
                  </span>
                ) : (
                  <span className="text-sm text-ui-muted-foreground">—</span>
                )}
              </TableCell>
              {actions ? (
                <TableCell>
                  <div
                    className={
                      "min-w-0 flex gap-1 items-center justify-end flex-wrap"
                    }
                  >
                    {assess &&
                    (b.status === "BOOKED" || b.status === "ATTENDED") ? (
                      <RecordOutcome booking={b} session={session} />
                    ) : null}
                    {assess && b.status === "BOOKED" ? (
                      <MarkNoShow booking={b} />
                    ) : null}
                    {book && b.status === "BOOKED" ? (
                      <CancelBooking booking={b} session={session} />
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
