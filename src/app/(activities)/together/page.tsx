import UiLink from "next/link";
import { Button } from "@/components/shadcn/button";
import { ItemGroup } from "@/components/shadcn/item";
import { Notice } from "@/components/ui-kit/notice";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Lead } from "@/components/ui-kit/prose";
import { AddToGroup, findTimesTogether, getCourses, getGroup, levelOptions, readWhatIf, SelectedSwimmer, TogetherResults, togetherHref, toMembers, withLevels } from "@/modules/activities/features/together";
import { screenPage } from "@/lib/page-guards";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { FlaskConical } from "lucide-react";

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
  const levels = levelOptions(courses);
  // What if: levels somebody wants to try for some of them (owner request, 21 October 2026).
  const whatIf = readWhatIf(typeof params.as === "string" ? params.as : "", chosenIds, new Set(levels.map((level) => level.id)));
  const assumed = chosen.filter((student) => whatIf[student.id]);
  const members = withLevels(toMembers(chosen), whatIf, courses);
  const result = chosen.length > 0 ? findTimesTogether(members, courses) : null;

  const hrefFor = (next: string[]) => togetherHref(next, whatIf);

  return (
    <PageShell spacing="roomy" header={<PageHeader
        title="Together"
        description="One trip to the pool for more than one child: find a day, or a single slot, that suits all of them"
        actions={chosen.length > 0 ? (
          <Button variant="outline" asChild>
            <UiLink href="/together">Start again</UiLink>
          </Button>
        ) : undefined}
      />}>

      <section className="pc-panel" aria-labelledby="together-children">
        <div className="pc-panel-head">
          <h2 id="together-children" className="text-lg font-semibold">Who&rsquo;s coming</h2>
        </div>
        {chosen.length > 0 ? (
          <>
            <Lead>
              Each child is checked at the level they are in now. To see what would work if one
              of them moved level, pick another level beside their name. Nothing changes on
              their record.
            </Lead>
            <ItemGroup>
              {chosen.map((student) => (
                <SelectedSwimmer
                  key={student.id}
                  swimmer={student}
                  group={chosenIds}
                  whatIf={whatIf}
                  levels={levels}
                />
              ))}
            </ItemGroup>
          </>
        ) : null}

        {chosen.length < GROUP_CAP ? (
          <AddToGroup chosen={chosenIds} whatIf={whatIf} />
        ) : (
          <span className="text-sm text-ui-muted-foreground">
            That is as many as this will search for at once.
          </span>
        )}

        {suggestions.length > 0 ? (
          <div className="min-w-0 flex gap-2 items-center flex-wrap">
            {/* Names whose contact it is rather than which field matched:
                "a email" needs an article that depends on the field, and the
                field is not what anybody needs to know. */}
            <span className="w-full text-sm text-ui-muted-foreground">
              Also on {suggestions[0].sharesWith}&rsquo;s contact:
            </span>
            {suggestions.map((student) => (
              <Button
                key={student.id}
                variant="outline"
                asChild={true}
              >
                <UiLink href={hrefFor([...chosenIds, student.id])} scroll={false}>
                  {<AppIcon name="plus" size="sm" />}
                  {student.name}
                </UiLink>
              </Button>
            ))}
            {suggestions.length > 1 ? (
              <Button variant="ghost" asChild>
                <UiLink
                  href={hrefFor([
                    ...chosenIds,
                    ...suggestions.map((s) => s.id),
                  ])}
                  scroll={false}
                >
                  Add all {suggestions.length}
                </UiLink>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {chosen.length === 0 ? (
        <EmptyState
          icon="users"
          title="Add the children you want to bring together"
          hint="Brothers and sisters, or two friends who want to come at the same time, it makes no difference. Add the first and anyone sharing their phone number or email is offered alongside."
        />
      ) : (
        <>
          {assumed.length > 0 ? (
            <Notice
              icon={FlaskConical}
              title={`What if ${assumed.map((s) => `${s.name} was in ${levels.find((level) => level.id === whatIf[s.id])!.name}`).join(" and ")}`}
              description={`These results pretend ${assumed.length === 1 ? "that level is" : "those levels are"} true${chosen.length > assumed.length ? ", and everyone else stays at their level now" : ""}. Nothing has changed on any child's record or class.`}
              actions={
                <Button variant="outline" asChild>
                  <UiLink href={togetherHref(chosenIds)} scroll={false}>Back to their levels now</UiLink>
                </Button>
              }
            />
          ) : null}

          {result && result.unplaced.length > 0 ? (
            <Notice
              title={`${result.unplaced.map((m) => m.name).join(", ")} ${result.unplaced.length === 1 ? "has" : "have"} no class level yet`}
              description="Together checks each child at a class level. Pick a level beside their name to see what would work, or remove them to compare the others."
              tone="warning"
            ></Notice>
          ) : null}

          <TogetherResults
            result={result}
            count={chosen.length}
            members={members}
          />
        </>
      )}
    </PageShell>
  );
}
