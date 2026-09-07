import { Heading } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Lead } from "@/components/ui-kit/prose";
import { CombinationList } from "@/components/together/combination-list";
import { formatTime, DAY_META } from "@/lib/courses/constants";
import type { TogetherResult, FamilyMember } from "@/lib/together/match";

export function TogetherResults({
  result,
  count,
  members,
}: {
  result: TogetherResult | null;
  count: number;
  members: FamilyMember[];
}) {
  if (!result || result.unplaced.length) return null;

  const withTogether = result.days.filter((day) => day.together.length > 0);
  const withSpread = result.days.filter((day) => day.spread);

  if (result.days.length === 0) {
    return (
      <EmptyState
        icon="calendarHeart"
        title={count > 1 ? "No day suits all of them" : "Nowhere with a place"}
        hint={
          count > 1
            ? "There is no day where every one of them has a place at their own level. Take one out of the group to see what the rest could do, or free up a place in a full class."
            : "There is no class with a place at their level."
        }
      />
    );
  }

  return (
    <VStack gap={6}>
      {withTogether.length > 0 ? (
        <VStack gap={3} as="section">
          <Heading level={2}>
            {count === 1 ? "Where they can swim" : `All ${count} starting at the same time`}
          </Heading>
          {count > 1 ? <Lead>Each option has a place for everyone. Check the class times before choosing.</Lead> : null}
          <VStack gap={3}>
            {withTogether.map((day) =>
              day.together.map((slot) => (
                <CombinationList
                  key={`${day.day}-${slot.startMinutes}`}
                  heading={`${DAY_META[day.day].label} ${formatTime(slot.startMinutes)}`}
                  members={members} courses={slot.courses}
                />
              ))
            )}
          </VStack>
        </VStack>
      ) : null}

      {withSpread.length > 0 ? (
        <VStack gap={3} as="section">
          <Heading level={2}>Same day, different times</Heading>
          <Lead>
            Every combination where the swimmers start at different times, including days with a same-time option.
          </Lead>
          <VStack gap={3}>
            {withSpread.map((day) => (
              <CombinationList
                key={day.day}
                heading={DAY_META[day.day].label}
                members={members} courses={day.spread!}
                differentTimes
              />
            ))}
          </VStack>
        </VStack>
      ) : null}
    </VStack>
  );
}
