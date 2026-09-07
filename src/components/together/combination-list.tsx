"use client";

import { useMemo, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Tag } from "@/components/ui-kit/tag";
import { PLACEMENT_META } from "@/lib/enrolment/constants";
import { capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import type { CourseRow } from "@/lib/courses/data/courses";
import { findCombinations, type FamilyMember, type Placement } from "@/lib/together/match";

/** Keep every result reachable without rendering an exponential list at once. */
type CombinationListProps = {
  heading: string;
  members: FamilyMember[];
  courses: CourseRow[];
  differentTimes?: boolean;
};

export function CombinationList(props: CombinationListProps) {
  // A changed family or refreshed capacity starts a fresh result set.
  const snapshot = JSON.stringify([props.members, props.courses]);
  return <CombinationPages key={snapshot} {...props} />;
}

function CombinationPages({ heading, members, courses, differentTimes = false }: CombinationListProps) {
  const [cursors, setCursors] = useState<(string[] | null)[]>([null]);
  const page = useMemo(() => findCombinations(members, courses, {
    after: cursors.at(-1), limit: 5, differentTimes,
  }), [members, courses, cursors, differentTimes]);
  const offset = (cursors.length - 1) * 5;
  return (
    <VStack gap={3} as="section">
      <Heading level={3}>{heading}</Heading>
      <Text color="secondary" aria-live="polite">
        {page.combinations.length === 1 && !page.next && offset === 0
          ? "1 combination"
          : `Combinations ${offset + 1}–${offset + page.combinations.length}${page.next ? " · more available" : " · last page"}`}
      </Text>
      {page.combinations.map((placements, index) => (
        <SlotList key={placements.map((p) => p.course.id).join(",")}
          heading={`Option ${offset + index + 1}`} placements={placements} showTimes />
      ))}
      {cursors.length > 1 || page.next ? (
        <HStack gap={2} wrap="wrap">
          <Button label={`Previous combinations for ${heading}`} isDisabled={cursors.length === 1}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}>Previous</Button>
          <Button label={`Next combinations for ${heading}`} isDisabled={!page.next}
            onClick={() => setCursors((previous) => [...previous, page.next])}>Next combinations</Button>
        </HStack>
      ) : null}
    </VStack>
  );
}
function SlotList({
  heading,
  placements,
  showTimes,
}: {
  heading: string;
  placements: Placement[];
  showTimes?: boolean;
}) {
  const sorted = showTimes
    ? [...placements].sort((a, b) => a.course.startMinutes - b.course.startMinutes)
    : placements;

  return (
    <List hasDividers header={<Heading level={4}>{heading}</Heading>}>
      {sorted.map((placement) => (
        <Item
          key={placement.studentId}
          as="li"
          label={<Text weight="medium">{placement.name}</Text>}
          description={
            <Text type="supporting">
              <Link href={`/courses/${placement.course.id}`} size="sm">
                {courseName(placement.course)}
              </Link>
              {showTimes ? ` · ${formatTime(placement.course.startMinutes)}–${formatTime(placement.course.startMinutes + placement.course.durationMinutes)}` : ""} ·{" "}
              {placement.course.level.name} ·{" "}
              {capacityLabel(placement.course._count.enrolments, placement.course.capacity)}
            </Text>
          }
          endContent={
            placement.alreadyIn ? (
              <Tag color={PLACEMENT_META.alreadyEnrolled.color}>{PLACEMENT_META.alreadyEnrolled.label}</Tag>
            ) : (
              <Tag color={PLACEMENT_META.hasPlace.color}>{PLACEMENT_META.hasPlace.label}</Tag>
            )
          }
        />
      ))}
    </List>
  );
}

