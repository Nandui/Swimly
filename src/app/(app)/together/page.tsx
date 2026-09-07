import type { Metadata } from "next";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AddToGroup } from "@/components/together/add-to-group";
import { TogetherResults } from "@/components/together/results";
import { SelectedSwimmer } from "@/components/together/selected-swimmer";
import { getCourses } from "@/lib/courses/data/courses";
import { screenPage } from "@/lib/page-guards";
import { getGroup, toMembers } from "@/lib/together/data/together";
import { findTimesTogether } from "@/lib/together/match";
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
              title={`${result.unplaced.map((m) => m.name).join(", ")} ${result.unplaced.length === 1 ? "has" : "have"} no current class level`}
              description="Together compares current enrolment levels. Add a class enrolment for these swimmers, or remove them from this group to compare the others."
            />
          ) : null}

          <TogetherResults result={result} count={chosen.length} members={toMembers(chosen)} />
        </>
      )}
    </VStack>
  );
}
