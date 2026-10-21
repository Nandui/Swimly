"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import {
  ItemContent,
  ItemActions,
  ItemDescription,
  Item,
  ItemGroup,
  ItemTitle,
} from "@/components/shadcn/item";

import { useMemo, useState } from "react";

import { Tag } from "@/components/ui-kit/tag";
import { PLACEMENT_META } from "@/modules/activities/shared/enrolment/constants";
import { WHAT_IF_META } from "@/modules/activities/features/together/constants";
import { capacityLabel, courseName, formatTime } from "@/modules/activities/shared/courses/constants";
import type { CourseRow } from "@/modules/activities/shared/courses/data/courses";
import {
  findCombinations,
  type FamilyMember,
  type Placement,
} from "@/modules/activities/features/together/server/match";

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
  const paged = cursors.length > 1 || Boolean(page.next);
  const many = paged || page.combinations.length > 1;
  return (
    <section aria-label={heading} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">{heading}</h3>
        <span aria-live="polite" className="text-sm text-ui-muted-foreground">
          {!paged
            ? `${page.combinations.length} ${page.combinations.length === 1 ? "option" : "options"}`
            : `Options ${offset + 1} to ${offset + page.combinations.length}${page.next ? ", more after these" : ", the last of them"}`}
        </span>
      </div>
      {page.combinations.map((placements, index) => (
        <SlotList
          key={placements.map((p) => p.course.id).join(",")}
          heading={many ? `Option ${offset + index + 1}` : null}
          placements={placements}
        />
      ))}
      {paged ? (
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
            disabled={cursors.length === 1}
            aria-label={`Previous options for ${heading}`}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCursors((previous) => [...previous, page.next])}
            disabled={!page.next}
            aria-label={`More options for ${heading}`}
          >
            More options
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** One option: each swimmer's class, earliest first. */
function SlotList({
  heading,
  placements,
}: {
  heading: string | null;
  placements: Placement[];
}) {
  const sorted = [...placements].sort(
    (a, b) => a.course.startMinutes - b.course.startMinutes,
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {heading ? <h4 className="text-sm font-semibold text-ui-muted-foreground">{heading}</h4> : null}
      <ItemGroup>
        {sorted.map((placement) => {
          const { course } = placement;
          const name = courseName(course);
          return (
            <Item
              key={placement.studentId}
              variant="outline"
              role="listitem"
              className="wrap-anywhere"
            >
              <ItemContent className="min-w-0">
                <ItemTitle>{placement.name}</ItemTitle>
                <ItemDescription>
                  <span className="tabular-nums whitespace-nowrap">
                    {formatTime(course.startMinutes)} to {formatTime(course.startMinutes + course.durationMinutes)}
                  </span>
                  {" · "}
                  <UiLink href={`/courses/${course.id}`} className="text-ui-foreground underline underline-offset-4">
                    {name}
                  </UiLink>
                  {name === course.level.name ? "" : ` · ${course.level.name}`}
                  {" · "}
                  {course.capacity === null
                    ? capacityLabel(course._count.enrolments, null)
                    : `${capacityLabel(course._count.enrolments, course.capacity)} places taken`}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="w-full flex-wrap sm:w-auto">
                {placement.whatIf ? <Tag meta={WHAT_IF_META} /> : null}
                <Tag meta={placement.alreadyIn ? PLACEMENT_META.alreadyEnrolled : PLACEMENT_META.hasPlace} />
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}
