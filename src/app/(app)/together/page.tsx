import UiLink from "next/link";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import type { Metadata } from "next";

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
  const result =
    chosen.length > 0 ? findTimesTogether(toMembers(chosen), courses) : null;

  const hrefFor = (next: string[]) =>
    next.length ? `/together?students=${next.join(",")}` : "/together";

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Together"
        description="One trip to the pool for more than one child: find a day — or a single slot — that suits all of them."
      />

      <div className="min-w-0 flex flex-col gap-3">
        {/* The group so far: removable selections with profile shortcuts. */}
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
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
            <span className="text-sm text-ui-muted-foreground">
              That is as many as this will search for at once.
            </span>
          )}

          {chosen.length > 0 ? (
            <UiLink
              href="/together"
              className={
                "text-ui-foreground underline-offset-4 hover:underline"
              }
            >
              Start again
            </UiLink>
          ) : null}
        </div>

        {suggestions.length > 0 ? (
          <div className="min-w-0 flex gap-2 items-center flex-wrap">
            {/* Names whose contact it is rather than which field matched:
                "a email" needs an article that depends on the field, and the
                field is not what anybody needs to know. */}
            <span className="text-sm text-ui-muted-foreground">
              Also on {suggestions[0].sharesWith}&rsquo;s contact:
            </span>
            {suggestions.map((student) => (
              <Button
                key={student.id}
                variant="outline"
                size="sm"
                asChild={true}
              >
                <UiLink href={hrefFor([...chosenIds, student.id])}>
                  {<AppIcon name="plus" size="sm" />}
                  {student.name}
                </UiLink>
              </Button>
            ))}
            {suggestions.length > 1 ? (
              <UiLink
                href={hrefFor([...chosenIds, ...suggestions.map((s) => s.id)])}
                className={
                  "text-ui-foreground underline-offset-4 hover:underline"
                }
              >
                add all {suggestions.length}
              </UiLink>
            ) : null}
          </div>
        ) : null}
      </div>

      {chosen.length === 0 ? (
        <EmptyState
          icon="users"
          title="Add the children you want to bring together"
          hint="Brothers and sisters, or two friends who want to come at the same time — it makes no difference. Add the first and anyone sharing their phone number or email is offered alongside."
        />
      ) : (
        <>
          {result && result.unplaced.length > 0 ? (
            <Notice
              title={`${result.unplaced.map((m) => m.name).join(", ")} ${result.unplaced.length === 1 ? "has" : "have"} no current class level`}
              description="Together compares current enrolment levels. Add a class enrolment for these swimmers, or remove them from this group to compare the others."
              tone="warning"
            ></Notice>
          ) : null}

          <TogetherResults
            result={result}
            count={chosen.length}
            members={toMembers(chosen)}
          />
        </>
      )}
    </div>
  );
}
