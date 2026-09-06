import { Card } from "@astryxdesign/core/Card";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
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
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { EndEnrolment, PromoteFromWaitlist } from "@/components/enrolment/enrolment-actions";
import { BOOKING_STATUS_META, sessionLabel } from "@/lib/assessments/constants";
import type { StudentAssessment } from "@/lib/assessments/data/assessments";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import type { StudentAttendance } from "@/lib/attendance/data/register";
import { courseLabel, courseName, formatSlotShort } from "@/lib/courses/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type { StudentEnrolment } from "@/lib/enrolment/data/enrolments";
import { formatDate } from "@/lib/format";

/** The pieces of a swimmer's profile. Server components: they render the
 *  client action buttons but hold no state of their own. */

/** One of the two at-a-glance panels: a card holding a titled list of
 *  facts, label beside value. */
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center" hAlign="between">
          <Heading level={2}>{title}</Heading>
          {action}
        </HStack>
        <MetadataList columns="single" label={{ position: "start", width: 112 }}>
          {children}
        </MetadataList>
      </VStack>
    </Card>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <MetadataListItem label={label}>{children}</MetadataListItem>;
}

export function Blank() {
  return <Text color="disabled">—</Text>;
}

export function EnrolmentTable({
  entries,
  student,
  manage,
}: {
  entries: StudentEnrolment[];
  student: { firstName: string; lastName: string };
  manage: boolean;
}) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Class</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Level
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Since
          </TableHeaderCell>
          <TableHeaderCell scope="col">Status</TableHeaderCell>
          {manage ? (
            <TableHeaderCell scope="col">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const meta = ENROLMENT_STATUS_META[entry.status];
          return (
            <TableRow key={entry.id}>
              <TableCell>
                <Link href={`/courses/${entry.course.id}`} weight="medium">
                  {courseName(entry.course)}
                </Link>
                <Text type="supporting" display="block">
                  {formatSlotShort(entry.course)}
                  {entry.course.instructor ? ` · ${entry.course.instructor.name}` : ""}
                </Text>
                <Text type="supporting" display="block" className="md:hidden">
                  {entry.programme.name} · {entry.level.name} · since {formatDate(entry.startedOn)}
                </Text>
                {entry.placementReason ? (
                  <Text type="supporting" display="block">
                    Placed here: {entry.placementReason}
                  </Text>
                ) : null}
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary">{entry.level.name}</Text>
                <Text type="supporting" display="block">
                  {entry.programme.name}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" textWrap="nowrap">
                  {formatDate(entry.startedOn)}
                </Text>
                {entry.endedOn ? (
                  <Text type="supporting" display="block">
                    to {formatDate(entry.endedOn)}
                  </Text>
                ) : null}
              </TableCell>
              <TableCell>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              {manage ? (
                <TableCell>
                  <HStack gap={1} vAlign="center" hAlign="end" wrap="wrap">
                    {entry.status === "WAITLISTED" ? (
                      <PromoteFromWaitlist enrolment={{ ...entry, student }} />
                    ) : null}
                    <EndEnrolment
                      enrolment={{ ...entry, student }}
                      classLabel={courseLabel(entry.course)}
                    />
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

export function AttendanceTable({ records }: { records: StudentAttendance[] }) {
  const missed = records.filter((record) => record.status === "ABSENT").length;

  return (
    <VStack gap={2}>
      <Lead>
        The last <Num>{records.length}</Num> {records.length === 1 ? "class" : "classes"}
        {missed > 0 ? (
          <>
            , <Alert tone="error">{missed}</Alert> of them missed
          </>
        ) : null}
        .
      </Lead>
      <Table hasHover textOverflow="wrap">
        <TableHeader>
          <TableRow isHeaderRow>
            <TableHeaderCell scope="col">Date</TableHeaderCell>
            <TableHeaderCell scope="col" className="max-md:hidden">
              Class
            </TableHeaderCell>
            <TableHeaderCell scope="col">Status</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const meta = ATTENDANCE_STATUS_META[record.status];
            return (
              <TableRow key={record.id}>
                <TableCell>
                  <Text hasTabularNumbers textWrap="nowrap">
                    {formatDate(record.date)}
                  </Text>
                  <Text type="supporting" display="block" className="md:hidden">
                    {courseName(record.course)}
                  </Text>
                </TableCell>
                <TableCell className="max-md:hidden">
                  <Text color="secondary">{courseName(record.course)}</Text>
                  <Text type="supporting" display="block">
                    {formatSlotShort(record.course)}
                  </Text>
                </TableCell>
                <TableCell>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  {record.note ? (
                    <Text type="supporting" display="block">
                      {record.note}
                    </Text>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </VStack>
  );
}

export function AssessmentList({ bookings }: { bookings: StudentAssessment[] }) {
  return (
    <VStack gap={3}>
      <List hasDividers>
        {bookings.map((booking) => {
          const meta = BOOKING_STATUS_META[booking.status];
          return (
            <Item
              key={booking.id}
              as="li"
              label={
                <Link href={`/assessments/${booking.session.id}`} weight="medium">
                  {sessionLabel(booking.session)}
                </Link>
              }
              description={
                <Text type="supporting">
                  {booking.session.programme.name}
                  {booking.session.type ? ` · ${booking.session.type.name}` : ""}
                  {booking.outcomeLevel ? (
                    <>
                      {" · placed at "}
                      <Text type="supporting" weight="medium" color="primary">
                        {booking.outcomeLevel.name}
                      </Text>
                      {booking.assessedByName ? ` by ${booking.assessedByName}` : ""}
                      {booking.outcomeNote ? ` — ${booking.outcomeNote}` : ""}
                    </>
                  ) : null}
                </Text>
              }
              endContent={<Tag color={meta.color}>{meta.label}</Tag>}
            />
          );
        })}
      </List>
      {bookings.some((booking) => booking.outcomeLevel) ? (
        <Text as="p" display="block" type="supporting" className="max-w-prose">
          A placement counts as having earned that level and every level below it in the
          programme, so they can be enrolled there without a reason being asked for.
        </Text>
      ) : null}
    </VStack>
  );
}
