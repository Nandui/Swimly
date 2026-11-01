import { Fragment } from "react";
import { Separator } from "@/components/shadcn/separator";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { CombinationList } from "@/modules/activities/features/together/components/combination-list";
import type { GroupMember } from "@/modules/activities/features/together/components/move-dialog";
import { WHAT_IF_META } from "@/modules/activities/features/together/constants";
import { formatTime, DAY_META } from "@/modules/activities/shared/courses/constants";
import type { TogetherResult, FamilyMember } from "@/modules/activities/features/together/server/match";

/** The answers: first every slot where they can all start together, then each day where they
 *  can come at different times. A what-if search says so on each heading and on each swimmer
 *  it assumed a level for. */
export function TogetherResults({
  result,
  count,
  members,
  group,
}: {
  result: TogetherResult | null;
  count: number;
  members: FamilyMember[];
  /** The group with their places, when the viewer may move them. */
  group?: GroupMember[];
}) {
  if (!result || result.unplaced.length) return null;

  const whatIf = members.some((member) => member.whatIf);
  const withTogether = result.days.filter((day) => day.together.length > 0);
  const withSpread = result.days.filter((day) => day.spread);

  if (result.days.length === 0) {
    return (
      <EmptyState
        icon="calendarHeart"
        title={count > 1 ? `No day suits all of them${whatIf ? " at these levels" : ""}` : "Nowhere with a place"}
        hint={
          count > 1
            ? `There is no day where every one of them has a place at ${whatIf ? "the level chosen for them" : "their own level"}. Try another level, take one out of the group to see what the rest could do, or free up a place in a full class.`
            : `There is no class with a place at ${whatIf ? "that level" : "their level"}.`
        }
      />
    );
  }

  const slots = withTogether.flatMap((day) => day.together.map((slot) => ({ day: day.day, slot })));

  return (
    <div className="min-w-0 flex flex-col gap-(--space-7)">
      {slots.length > 0 ? (
        <section className="flex min-w-0 flex-col" aria-labelledby="together-same-time">
          <div className="pc-section-head">
            <h2 id="together-same-time">
              {count === 1 ? "Where they can swim" : `All ${count} starting at the same time`}
            </h2>
            {whatIf ? <Tag meta={WHAT_IF_META} /> : null}
          </div>
          {count > 1 ? (
            <p className="pc-section-note">
              Each option has a place for everyone. Check the class times before choosing.
            </p>
          ) : null}
          <div className="rec-card">
          {slots.map(({ day, slot }, index) => (
            <Fragment key={`${day}-${slot.startMinutes}`}>
              {index > 0 ? <Separator /> : null}
              <CombinationList
                heading={`${DAY_META[day].label} ${formatTime(slot.startMinutes)}`}
                members={members}
                courses={slot.courses}
                group={group}
              />
            </Fragment>
          ))}
          </div>
        </section>
      ) : null}

      {withSpread.length > 0 ? (
        <section className="flex min-w-0 flex-col" aria-labelledby="together-same-day">
          <div className="pc-section-head">
            <h2 id="together-same-day">
              Same day, different times
            </h2>
            {whatIf ? <Tag meta={WHAT_IF_META} /> : null}
          </div>
          <p className="pc-section-note">
            Every option where they start at different times, including days with a same-time
            option.
          </p>
          <div className="rec-card">
          {withSpread.map((day, index) => (
            <Fragment key={day.day}>
              {index > 0 ? <Separator /> : null}
              <CombinationList
                heading={DAY_META[day.day].label}
                members={members}
                courses={day.spread!}
                differentTimes
                group={group}
              />
            </Fragment>
          ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
