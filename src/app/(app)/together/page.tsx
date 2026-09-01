import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, Plus, Users, X } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddToGroup } from "@/components/together/add-to-group";
import { capacityLabel, courseName, formatTime, DAY_META } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { pageSession } from "@/lib/page-guards";
import { getStudentOptions } from "@/lib/students/data/students";
import { getGroup, toMembers } from "@/lib/together/data/together";
import { findTimesTogether, type Placement } from "@/lib/together/match";

export const metadata: Metadata = { title: "Together" };

/** Capped so a mistyped URL cannot ask for a search across the whole club. */
const GROUP_CAP = 8;

export default async function TogetherPage(props: PageProps<"/together">) {
  await pageSession();

  const params = await props.searchParams;
  const raw = typeof params.students === "string" ? params.students : "";
  const ids = [...new Set(raw.split(",").filter(Boolean))].slice(0, GROUP_CAP);

  const [options, group, courses] = await Promise.all([
    getStudentOptions(),
    getGroup(ids),
    ids.length ? getCourses() : Promise.resolve([]),
  ]);

  const { chosen, suggestions } = group;
  const result = chosen.length > 0 ? findTimesTogether(toMembers(chosen), courses) : null;

  const hrefFor = (next: string[]) => ({
    pathname: "/together",
    query: next.length ? { students: next.join(",") } : {},
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Together"
        description="One trip to the pool for more than one child: find a day — or a single slot — that suits all of them."
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {chosen.map((student) => (
            <span
              key={student.id}
              className="inline-flex h-8 items-center rounded-md border bg-accent text-[13px]"
            >
              <Link
                href={`/students/${student.id}`}
                className="px-2.5 font-medium text-foreground underline-offset-2 hover:underline"
              >
                {student.name}
              </Link>
              <span className="pr-2 pl-1 text-muted-foreground">
                · {student.levelName ?? "no level"}
              </span>
              <Link
                href={hrefFor(ids.filter((id) => id !== student.id))}
                aria-label={`Take ${student.name} out of the group`}
                className="inline-flex h-full items-center rounded-r-md border-l px-1.5 opacity-60 hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden />
              </Link>
            </span>
          ))}

          {chosen.length < GROUP_CAP ? (
            <AddToGroup options={options} chosen={ids} full={false} />
          ) : (
            <span className="text-[13px] text-muted-foreground">
              That is as many as this will search for at once.
            </span>
          )}

          {chosen.length > 0 ? (
            <Link
              href="/together"
              className="px-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Start again
            </Link>
          ) : null}
        </div>

        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            {/* Names whose contact it is rather than which field matched:
                "a email" needs an article that depends on the field, and the
                field is not what anybody needs to know. */}
            <span>Also on {suggestions[0].sharesWith}&rsquo;s contact:</span>
            {suggestions.map((student) => (
              <Link
                key={student.id}
                href={hrefFor([...ids, student.id])}
                className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="size-3 opacity-60" aria-hidden />
                {student.name}
              </Link>
            ))}
            {suggestions.length > 1 ? (
              <Link
                href={hrefFor([...ids, ...suggestions.map((s) => s.id)])}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                add all {suggestions.length}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {chosen.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add the children you want to bring together"
          hint="Brothers and sisters, or two friends who want to come at the same time — it makes no difference. Add the first and anyone sharing their phone number or email is offered alongside."
        />
      ) : (
        <>
          {result && result.unplaced.length > 0 ? (
            <p className="max-w-prose rounded-md border border-(--tag-orange-bg) bg-(--tag-orange-bg)/40 px-3 py-2 text-[13px]">
              {result.unplaced.map((m) => m.name).join(", ")}{" "}
              {result.unplaced.length === 1 ? "has" : "have"} no level yet, so there is nothing to
              search on. Enrol {result.unplaced.length === 1 ? "them" : "each of them"} once and
              this will include {result.unplaced.length === 1 ? "them" : "them all"}.
            </p>
          ) : null}

          <Results result={result} count={chosen.length} />
        </>
      )}
    </div>
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
        icon={CalendarHeart}
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
    <div className="space-y-6">
      {withTogether.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {count === 1 ? "Where they can swim" : `All ${count} in the water at once`}
          </h2>
          {count > 1 ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              One drop-off, one wait, one pick-up.
            </p>
          ) : null}
          <div className="space-y-3">
            {withTogether.map((day) =>
              day.together.map((slot) => (
                <SlotCard
                  key={`${day.day}-${slot.startMinutes}`}
                  heading={`${DAY_META[day.day].label} ${formatTime(slot.startMinutes)}`}
                  placements={slot.placements}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

      {spreadOnly.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Same day, different times</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Nothing lines up exactly on {spreadOnly.length === 1 ? "this day" : "these days"}, but
            everyone can swim.
          </p>
          <div className="space-y-3">
            {spreadOnly.map((day) => (
              <SlotCard
                key={day.day}
                heading={DAY_META[day.day].label}
                placements={day.spread!}
                showTimes
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SlotCard({
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
    <div className="overflow-hidden rounded-md border">
      <p className="border-b bg-sidebar px-3 py-2 text-[13px] font-medium text-foreground">
        {heading}
      </p>
      <ul>
        {sorted.map((placement) => (
          <li
            key={placement.studentId}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2 text-sm last:border-0"
          >
            <span className="min-w-0">
              <span className="font-medium text-foreground">{placement.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                <Link
                  href={`/courses/${placement.course.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {courseName(placement.course)}
                </Link>
                {showTimes ? ` · ${formatTime(placement.course.startMinutes)}` : ""} ·{" "}
                {placement.course.level.name} ·{" "}
                {capacityLabel(placement.course._count.enrolments, placement.course.capacity)}
              </span>
            </span>
            {placement.alreadyIn ? (
              <Tag color="green">Already in it</Tag>
            ) : (
              <Tag color="gray">Has a place</Tag>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
