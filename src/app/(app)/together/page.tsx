import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { FamilyPicker } from "@/components/together/family-picker";
import { DAY_META, capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import { getCourses } from "@/lib/courses/data/courses";
import { pageSession } from "@/lib/page-guards";
import { getStudentOptions } from "@/lib/students/data/students";
import { ageLabel } from "@/lib/students/constants";
import { getFamily, toMembers, type FamilyStudent } from "@/lib/together/data/together";
import { findTimesTogether, type Placement } from "@/lib/together/match";

export const metadata: Metadata = { title: "Together" };

export default async function TogetherPage(props: PageProps<"/together">) {
  await pageSession();

  const params = await props.searchParams;
  const studentId = typeof params.student === "string" ? params.student : "";
  const dropped = new Set(
    (typeof params.without === "string" ? params.without : "").split(",").filter(Boolean)
  );

  const [options, found, courses] = await Promise.all([
    getStudentOptions(),
    studentId ? getFamily(studentId) : Promise.resolve(null),
    studentId ? getCourses() : Promise.resolve([]),
  ]);

  const family = found?.family ?? [];
  const included = family.filter((member) => !dropped.has(member.id));
  const result = found ? findTimesTogether(toMembers(included), courses) : null;

  const withoutHref = (member: FamilyStudent) => {
    const next = dropped.has(member.id)
      ? [...dropped].filter((id) => id !== member.id)
      : [...dropped, member.id];
    return {
      pathname: "/together",
      query: { student: studentId, ...(next.length ? { without: next.join(",") } : {}) },
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Together"
        description="One family, one trip to the pool: find a day — or a single slot — that suits every child."
      />

      <FamilyPicker options={options} selected={studentId} />

      {!found ? (
        <EmptyState
          icon={Users}
          title={studentId ? "No such swimmer" : "Pick a child to start"}
          hint={
            studentId
              ? "That student no longer exists. Try another."
              : "Their brothers and sisters are found by the phone number and email their records share, so you only need one of them."
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {family.length === 1 ? "One swimmer" : `${family.length} swimmers on this contact`}
            </h2>

            {family.length === 1 ? (
              <p className="max-w-prose text-sm text-muted-foreground">
                Nobody else shares {found.anchor.name.split(" ")[0]}&rsquo;s phone number or email,
                so there is only one timetable to fit. Anything below is simply where they can
                swim.
              </p>
            ) : null}

            <ul className="overflow-hidden rounded-md border">
              {family.map((member) => {
                const out = dropped.has(member.id);
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b p-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className={out ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
                        <Link
                          href={`/students/${member.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {member.name}
                        </Link>
                        {member.id === found.anchor.id ? (
                          <Tag color="blue" className="ml-2">
                            Picked
                          </Tag>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ageLabel(member.dateOfBirth)} ·{" "}
                        {member.levelName ?? <span className="text-(--tag-orange-fg)">No level yet</span>}
                        {member.id !== found.anchor.id && member.linkedBy.length > 0
                          ? ` · same ${member.linkedBy.join(" and ")}`
                          : ""}
                      </p>
                    </div>
                    {member.id === found.anchor.id ? null : (
                      <Link
                        href={withoutHref(member)}
                        className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {out ? "Put back" : "Not a sibling"}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            {found.overflowed ? (
              <p className="max-w-prose text-xs text-muted-foreground">
                Stopped at ten. A contact shared by more than that is usually an address rather
                than a family — a school, or a childminder.
              </p>
            ) : null}
          </section>

          {result && result.unplaced.length > 0 ? (
            <p className="max-w-prose rounded-md border border-(--tag-orange-bg) bg-(--tag-orange-bg)/40 px-3 py-2 text-[13px]">
              {result.unplaced.map((m) => m.name).join(", ")}{" "}
              {result.unplaced.length === 1 ? "has" : "have"} no level yet, so there is nothing to
              search on. Enrol {result.unplaced.length === 1 ? "them" : "each of them"} once and
              this will include {result.unplaced.length === 1 ? "them" : "them all"}.
            </p>
          ) : null}

          <Results result={result} names={included.length} />
        </>
      )}
    </div>
  );
}

function Results({
  result,
  names,
}: {
  result: ReturnType<typeof findTimesTogether> | null;
  names: number;
}) {
  if (!result) return null;

  const withTogether = result.days.filter((day) => day.together.length > 0);
  const spreadOnly = result.days.filter((day) => day.spread);

  if (result.days.length === 0) {
    return (
      <EmptyState
        icon={CalendarHeart}
        title="No day fits all of them"
        hint={
          names > 1
            ? "There is no day where every child has a place at their own level. Take one out of the group above to see what the rest could do, or free up a place in a full class."
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
            {names === 1 ? "Where they can swim" : `All ${names} in the water at once`}
          </h2>
          {names > 1 ? (
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
