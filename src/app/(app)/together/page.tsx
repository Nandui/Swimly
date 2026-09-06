import { PLACEMENT_META } from "@/lib/enrolment/constants";
import type { Metadata } from "next";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { AddToGroup } from "@/components/together/add-to-group";
import { SelectedSwimmer } from "@/components/together/selected-swimmer";
import { capacityLabel, courseName, formatTime, DAY_META } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { screenPage } from "@/lib/page-guards";
import { getGroup, toMembers } from "@/lib/together/data/together";
import { findTimesTogether, type Placement } from "@/lib/together/match";
import { AppIcon } from "@/components/ui-kit/app-icon";

export const metadata: Metadata = { title: "Together" };

/** Capped so a mistyped URL cannot ask for a search across the whole club. */
const GROUP_CAP = 8;

export default async function TogetherPage(props: PageProps<"/together">) {
  await screenPage("together");

  const params = await props.searchParams;
  const raw = typeof params.students === "string" ? params.students : "";
  const ids = [...new Set(raw.split(",").filter(Boolean))].slice(0, GROUP_CAP);

  const [group, courses] = await Promise.all([
    getGroup(ids),
    ids.length ? getCourses() : Promise.resolve([]),
  ]);

  const { chosen } = group;
  const chosenIds = chosen.map((student) => student.id);
  const suggestions = group.suggestions.slice(0, GROUP_CAP - chosen.length);
  const result = chosen.length > 0 ? findTimesTogether(toMembers(chosen), courses) : null;

  const hrefFor = (next: string[]) =>
    next.length ? `/together?students=${next.join(",")}` : "/together";

  return (
    <VStack gap={6}>
      <PageHeader
        title="Together"
        description="One trip to the pool for more than one child: find a day — or a single slot — that suits all of them."
      />

      <VStack gap={3}>
        {/* The group so far: removable selections with profile shortcuts. */}
        <HStack gap={2} vAlign="center" wrap="wrap">
          {chosen.map((student) => (
            <SelectedSwimmer
              key={student.id}
              id={student.id}
              name={student.name}
              levelName={student.levelName}
              removeHref={hrefFor(chosenIds.filter((id) => id !== student.id))}
            />
          ))}

          {chosen.length < GROUP_CAP ? (
            <AddToGroup chosen={chosenIds} />
          ) : (
            <Text color="secondary">That is as many as this will search for at once.</Text>
          )}

          {chosen.length > 0 ? (
            <Link href="/together" color="secondary" isStandalone>
              Start again
            </Link>
          ) : null}
        </HStack>

        {suggestions.length > 0 ? (
          <HStack gap={2} vAlign="center" wrap="wrap">
            {/* Names whose contact it is rather than which field matched:
                "a email" needs an article that depends on the field, and the
                field is not what anybody needs to know. */}
            <Text color="secondary">Also on {suggestions[0].sharesWith}&rsquo;s contact:</Text>
            {suggestions.map((student) => (
              <Button
                key={student.id}
                label={student.name}
                variant="secondary"
                size="sm"
                href={hrefFor([...chosenIds, student.id])}
                icon={<AppIcon name="plus" size="sm" />}
              />
            ))}
            {suggestions.length > 1 ? (
              <Link href={hrefFor([...chosenIds, ...suggestions.map((s) => s.id)])} isStandalone>
                add all {suggestions.length}
              </Link>
            ) : null}
          </HStack>
        ) : null}
      </VStack>

      {chosen.length === 0 ? (
        <EmptyState
          icon="users"
          title="Add the children you want to bring together"
          hint="Brothers and sisters, or two friends who want to come at the same time — it makes no difference. Add the first and anyone sharing their phone number or email is offered alongside."
        />
      ) : (
        <>
          {result && result.unplaced.length > 0 ? (
            <Banner
              status="warning"
              collapsible={false}
              title={`${result.unplaced.map((m) => m.name).join(", ")} ${result.unplaced.length === 1 ? "has" : "have"} no level yet`}
              description={`There is nothing to search on for ${result.unplaced.length === 1 ? "them" : "each of them"}. Enrol ${result.unplaced.length === 1 ? "them" : "each of them"} once and this will include ${result.unplaced.length === 1 ? "them" : "them all"}.`}
            />
          ) : null}

          <Results result={result} count={chosen.length} />
        </>
      )}
    </VStack>
  );
}

function Results({
  result,
  count,
}: {
  result: ReturnType<typeof findTimesTogether> | null;
  count: number;
}) {
  if (!result) return null;

  const withTogether = result.days.filter((day) => day.together.length > 0);
  const spreadOnly = result.days.filter((day) => day.spread);

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
            {count === 1 ? "Where they can swim" : `All ${count} in the water at once`}
          </Heading>
          {count > 1 ? <Lead>One drop-off, one wait, one pick-up.</Lead> : null}
          <VStack gap={3}>
            {withTogether.map((day) =>
              day.together.map((slot) => (
                <SlotList
                  key={`${day.day}-${slot.startMinutes}`}
                  heading={`${DAY_META[day.day].label} ${formatTime(slot.startMinutes)}`}
                  placements={slot.placements}
                />
              ))
            )}
          </VStack>
        </VStack>
      ) : null}

      {spreadOnly.length > 0 ? (
        <VStack gap={3} as="section">
          <Heading level={2}>Same day, different times</Heading>
          <Lead>
            Nothing lines up exactly on {spreadOnly.length === 1 ? "this day" : "these days"}, but
            everyone can swim.
          </Lead>
          <VStack gap={3}>
            {spreadOnly.map((day) => (
              <SlotList
                key={day.day}
                heading={DAY_META[day.day].label}
                placements={day.spread!}
                showTimes
              />
            ))}
          </VStack>
        </VStack>
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
    <List hasDividers header={<Heading level={3}>{heading}</Heading>}>
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
              {showTimes ? ` · ${formatTime(placement.course.startMinutes)}` : ""} ·{" "}
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
