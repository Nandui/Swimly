"use client";
import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import { useMemo, useState } from "react";

import { Tag } from "@/components/ui-kit/tag";
import { PLACEMENT_META } from "@/lib/enrolment/constants";
import { capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import type { CourseRow } from "@/lib/courses/data/courses";
import {
  findCombinations,
  type FamilyMember,
  type Placement,
} from "@/lib/together/match";

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

function CombinationPages({
  heading,
  members,
  courses,
  differentTimes = false,
}: CombinationListProps) {
  const [cursors, setCursors] = useState<(string[] | null)[]>([null]);
  const page = useMemo(
    () =>
      findCombinations(members, courses, {
        after: cursors.at(-1),
        limit: 5,
        differentTimes,
      }),
    [members, courses, cursors, differentTimes],
  );
  const offset = (cursors.length - 1) * 5;
  return (
    <section className="min-w-0 flex flex-col gap-3">
      <h3 className="text-base font-semibold tracking-tight">{heading}</h3>
      <span aria-live="polite" className="text-sm text-ui-muted-foreground">
        {page.combinations.length === 1 && !page.next && offset === 0
          ? "1 combination"
          : `Combinations ${offset + 1}–${offset + page.combinations.length}${page.next ? " · more available" : " · last page"}`}
      </span>
      {page.combinations.map((placements, index) => (
        <SlotList
          key={placements.map((p) => p.course.id).join(",")}
          heading={`Option ${offset + index + 1}`}
          placements={placements}
          showTimes
        />
      ))}
      {cursors.length > 1 || page.next ? (
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
          <Button
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
            disabled={cursors.length === 1}
            aria-label={`Previous combinations for ${heading}`}
          >
            Previous
          </Button>
          <Button
            onClick={() => setCursors((previous) => [...previous, page.next])}
            disabled={!page.next}
            aria-label={`Next combinations for ${heading}`}
          >
            Next combinations
          </Button>
        </div>
      ) : null}
    </section>
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
    ? [...placements].sort(
        (a, b) => a.course.startMinutes - b.course.startMinutes,
      )
    : placements;

  return (
    <section className="space-y-3">
      {<h4 className="text-base font-semibold tracking-tight">{heading}</h4>}
      <ItemGroup className="divide-y divide-ui-border">
        {sorted.map((placement) => (
          <Item
            key={placement.studentId}
            role="listitem"
            className="[overflow-wrap:anywhere]"
          >
            <ItemContent className="min-w-0">
              <div className="text-sm font-medium">
                {
                  <span className="text-sm text-ui-foreground font-medium">
                    {placement.name}
                  </span>
                }
              </div>
              <div className="text-sm text-ui-muted-foreground">
                {
                  <span className="text-sm text-ui-muted-foreground">
                    <UiLink
                      href={`/courses/${placement.course.id}`}
                      className={
                        "text-ui-foreground underline-offset-4 hover:underline text-sm"
                      }
                    >
                      {courseName(placement.course)}
                    </UiLink>
                    {showTimes
                      ? ` · ${formatTime(placement.course.startMinutes)}–${formatTime(placement.course.startMinutes + placement.course.durationMinutes)}`
                      : ""}{" "}
                    · {placement.course.level.name} ·{" "}
                    {capacityLabel(
                      placement.course._count.enrolments,
                      placement.course.capacity,
                    )}
                  </span>
                }
              </div>
            </ItemContent>
            <ItemActions className="flex-wrap">
              {placement.alreadyIn ? (
                <Tag color={PLACEMENT_META.alreadyEnrolled.color}>
                  {PLACEMENT_META.alreadyEnrolled.label}
                </Tag>
              ) : (
                <Tag color={PLACEMENT_META.hasPlace.color}>
                  {PLACEMENT_META.hasPlace.label}
                </Tag>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
