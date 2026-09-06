import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
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
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddSession, CancelSession, EditSession } from "@/components/assessments/session-actions";
import { isPast, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import {
  getAssessmentProgrammeOptions,
  getAssessmentSessions,
  getAssessmentTypeOptions,
  type AssessmentTypeOption,
  type ProgrammeOption,
  type SessionRow,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { getInstructorOptions, type InstructorOption } from "@/lib/courses/data/courses";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const session = await screenPage("assessments");
  const manage = can(session, "courses.manage");
  const todayIso = today();

  const [sessions, programmes, types, instructors] = await Promise.all([
    getAssessmentSessions(),
    manage ? getAssessmentProgrammeOptions() : Promise.resolve([]),
    manage ? getAssessmentTypeOptions() : Promise.resolve([]),
    manage ? getInstructorOptions() : Promise.resolve([]),
  ]);

  const live = sessions.filter((s) => !s.cancelledAt);
  const upcoming = live.filter((s) => !isPast(s, todayIso));
  const past = live.filter((s) => isPast(s, todayIso)).reverse();
  const cancelled = sessions.filter((s) => s.cancelledAt).reverse();

  const placesLeft = upcoming.reduce(
    (n, s) => n + (s.capacity === null ? 0 : Math.max(0, s.capacity - s._count.bookings)),
    0
  );
  const uncapped = upcoming.some((s) => s.capacity === null);

  const add = manage ? (
    <AddSession programmes={programmes} types={types} instructors={instructors} today={todayIso} />
  ) : null;

  const tableProps = { manage, programmes, types, instructors, today: todayIso };

  return (
    <VStack gap={6}>
      <PageHeader
        title="Assessments"
        description="Book a child onto a session; once they have been in the water, place them at the level they belong at."
        actions={add}
      />

      <Lead>
        {upcoming.length === 0 ? (
          "No sessions coming up."
        ) : (
          <>
            <Num>{upcoming.length}</Num> {upcoming.length === 1 ? "session" : "sessions"} coming
            up
            {uncapped ? (
              ", with no limit on places"
            ) : (
              <>
                , with <Num>{placesLeft}</Num> {placesLeft === 1 ? "place" : "places"} left between
                them
              </>
            )}
            .
          </>
        )}
      </Lead>

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No assessment sessions yet"
          hint="Add the first — a date, a time and how many children can be watched at once. The desk books children onto it from there."
          action={add}
        />
      ) : (
        <VStack gap={6}>
          <VStack gap={3} as="section">
            <Heading level={2}>Coming up</Heading>
            {upcoming.length === 0 ? (
              <Text as="p" display="block" color="secondary">
                Nothing scheduled.
              </Text>
            ) : (
              <SessionTable sessions={upcoming} {...tableProps} />
            )}
          </VStack>

          {past.length > 0 ? (
            <VStack gap={3} as="section">
              <Heading level={2}>Already run</Heading>
              <SessionTable sessions={past} {...tableProps} />
            </VStack>
          ) : null}

          {cancelled.length > 0 ? (
            <VStack gap={3} as="section">
              <Heading level={2}>Cancelled</Heading>
              <SessionTable sessions={cancelled} {...tableProps} manage={false} />
            </VStack>
          ) : null}
        </VStack>
      )}
    </VStack>
  );
}

function SessionTable({
  sessions,
  manage,
  programmes,
  types,
  instructors,
  today,
}: {
  sessions: SessionRow[];
  manage: boolean;
  programmes: ProgrammeOption[];
  types: AssessmentTypeOption[];
  instructors: InstructorOption[];
  today: string;
}) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">When</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Programme
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-lg:hidden">
            Assessor
          </TableHeaderCell>
          <TableHeaderCell scope="col">Places</TableHeaderCell>
          {manage ? (
            <TableHeaderCell scope="col">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => {
          const taken = s._count.bookings;
          const full = s.capacity !== null && taken >= s.capacity;
          return (
            <TableRow key={s.id}>
              <TableCell>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Link href={`/assessments/${s.id}`} weight="medium">
                    {sessionDay(s)}
                  </Link>
                  {s.cancelledAt ? (
                    <Tag color="gray">Cancelled</Tag>
                  ) : full ? (
                    <Tag color="yellow">Full</Tag>
                  ) : null}
                </HStack>
                <Text type="supporting" display="block" hasTabularNumbers>
                  {sessionSpan(s)}
                  {s.location ? ` · ${s.location}` : ""}
                </Text>
                <Text type="supporting" display="block" className="md:hidden">
                  {s.programme.name} · {s.type?.name ?? "kind not set"}
                  {s.instructor ? ` · ${s.instructor.name}` : ""}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary">{s.programme.name}</Text>
                {s.type ? (
                  <Text type="supporting" display="block">
                    {s.type.name}
                  </Text>
                ) : (
                  <Tag color="orange">Kind not set</Tag>
                )}
              </TableCell>
              <TableCell className="max-lg:hidden">
                {s.instructor ? (
                  <Text color="secondary">{s.instructor.name}</Text>
                ) : (
                  <Tag color="orange">Not decided</Tag>
                )}
              </TableCell>
              <TableCell>
                <Text color="secondary" hasTabularNumbers textWrap="nowrap">
                  {s.capacity === null ? `${taken} booked` : `${taken} of ${s.capacity}`}
                </Text>
              </TableCell>
              {manage ? (
                <TableCell>
                  {s.cancelledAt ? null : (
                    <HStack gap={1} vAlign="center" hAlign="end">
                      <EditSession
                        session={s}
                        programmes={programmes}
                        types={types}
                        instructors={instructors}
                        today={today}
                      />
                      <CancelSession session={s} />
                    </HStack>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
