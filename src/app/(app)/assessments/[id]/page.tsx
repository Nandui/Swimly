import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
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
import { CancelSession, EditSession } from "@/components/assessments/session-actions";
import { WrongClub } from "@/components/clubs/wrong-club";
import { BOOKING_STATUS_META, HOLDS_A_PLACE, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import {
  getAssessmentProgrammeOptions,
  getAssessmentSession,
  getAssessmentTypeOptions,
  type BookingRow,
  type SessionDetail,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getInstructorOptions } from "@/lib/courses/data/courses";
import { formatDate, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { ageLabel, fullName } from "@/lib/students/constants";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentSessionPage(props: PageProps<"/assessments/[id]">) {
  const auth = await screenPage("assessments");
  const book = can(auth, "enrolment.manage");
  const assess = can(auth, "assessments.run");
  const manage = can(auth, "courses.manage");
  const { id } = await props.params;

  const [session, programmes, types, instructors, { club }] = await Promise.all([
    getAssessmentSession(id),
    manage ? getAssessmentProgrammeOptions() : Promise.resolve([]),
    manage ? getAssessmentTypeOptions() : Promise.resolve([]),
    manage ? getInstructorOptions() : Promise.resolve([]),
    getCurrentClub(),
  ]);
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

  const holding = session.bookings.filter((b) => HOLDS_A_PLACE.includes(b.status));
  const gone = session.bookings.filter((b) => !HOLDS_A_PLACE.includes(b.status));
  const taken = holding.length;
  const full = session.capacity !== null && taken >= session.capacity;
  const placed = holding.filter((b) => b.outcomeLevel).length;
  const open = !session.cancelledAt;

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <BackLink href="/assessments" current={sessionDay(session)}>
          Assessments
        </BackLink>
        <PageHeader
          title={
            <HStack gap={2} vAlign="center" wrap="wrap">
              {sessionDay(session)}
              {session.cancelledAt ? <Tag color="gray">Cancelled</Tag> : null}
              {open && full ? <Tag color="yellow">Full</Tag> : null}
            </HStack>
          }
          description={
            `${sessionSpan(session)} · ${session.programme.name} · ${session.type?.name ?? "kind not set"}` +
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
                    types={types}
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
      </VStack>

      <Lead>
        <Num>
          {session.capacity === null ? `${taken} booked` : `${taken} of ${session.capacity}`}
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
          action={book && open ? <BookOntoSession session={session} taken={0} /> : null}
        />
      ) : (
        <VStack gap={6}>
          <VStack gap={3} as="section">
            <Heading level={2}>Booked</Heading>
            {holding.length === 0 ? (
              <Text as="p" display="block" color="secondary">
                Nobody is holding a place.
              </Text>
            ) : (
              <BookingTable entries={holding} session={session} book={book} assess={assess} />
            )}
          </VStack>

          {gone.length > 0 ? (
            <VStack gap={3} as="section">
              <Heading level={2}>Not coming</Heading>
              <BookingTable entries={gone} session={session} book={book} assess={assess} />
            </VStack>
          ) : null}
        </VStack>
      )}
    </VStack>
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
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Swimmer</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Age
          </TableHeaderCell>
          <TableHeaderCell scope="col">Status</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Placed at
          </TableHeaderCell>
          {actions ? (
            <TableHeaderCell scope="col">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((b) => {
          const meta = BOOKING_STATUS_META[b.status];
          return (
            <TableRow key={b.id}>
              <TableCell>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Link href={`/students/${b.student.id}`} weight="medium">
                    {fullName(b.student)}
                  </Link>
                  {b.student.medicalNotes ? <Tag color="red">Medical</Tag> : null}
                </HStack>
                <Text type="supporting" display="block">
                  <Text type="supporting" className="md:hidden">{ageLabel(b.student.dateOfBirth)} · </Text>
                  booked by {b.bookedByName}
                </Text>
                {/* The placement column leaves the table on a phone and
                    re-homes here, so the row stays one screen wide. */}
                {b.outcomeLevel ? (
                  <Text type="supporting" display="block" className="md:hidden">
                    Placed at{" "}
                    <Text type="supporting" weight="medium" color="primary">
                      {b.outcomeLevel.name}
                    </Text>
                    {b.assessedByName ? ` by ${b.assessedByName}` : ""}
                  </Text>
                ) : null}
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" hasTabularNumbers>
                  {ageLabel(b.student.dateOfBirth)}
                </Text>
              </TableCell>
              <TableCell>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              <TableCell className="max-md:hidden">
                {b.outcomeLevel ? (
                  <>
                    <Text weight="medium">{b.outcomeLevel.name}</Text>
                    {b.outcomeNote ? (
                      <Text type="supporting" display="block">
                        {b.outcomeNote}
                      </Text>
                    ) : null}
                    <Text type="supporting" display="block">
                      {b.assessedByName}
                      {b.assessedOn ? `, ${formatDate(b.assessedOn)}` : ""}
                    </Text>
                  </>
                ) : b.status === "BOOKED" ? (
                  <Text type="supporting">Not yet</Text>
                ) : (
                  <Text color="disabled">—</Text>
                )}
              </TableCell>
              {actions ? (
                <TableCell>
                  <HStack gap={1} vAlign="center" hAlign="end" wrap="wrap">
                    {assess && (b.status === "BOOKED" || b.status === "ATTENDED") ? (
                      <RecordOutcome booking={b} session={session} />
                    ) : null}
                    {assess && b.status === "BOOKED" ? <MarkNoShow booking={b} /> : null}
                    {book && b.status === "BOOKED" ? (
                      <CancelBooking booking={b} session={session} />
                    ) : null}
                  </HStack>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
