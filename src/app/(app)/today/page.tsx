import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ClipboardList, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { canMarkRegister } from "@/lib/attendance/access";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { DAY_META, capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import { getCoursesOnDay, type CourseRow } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { permissionPage } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

type Grouping = "time" | "level";

/** The deck screen: what an instructor holds in one hand at the poolside.
 *
 *  Their own classes first — the ones they teach, and the ones they have
 *  taken over today — then every class running, for whoever is covering or
 *  just looking. Either list is grouped by start time, the order the day
 *  actually happens in, or by level, for an instructor who has the same
 *  checklist open across three classes. Each class is two taps from done:
 *  the register, and the checklist. A class that is not theirs asks, on the
 *  way in, whether they are taking it. */
export default async function TodayPage(props: PageProps<"/today">) {
  const session = await permissionPage("attendance.mark");
  const params = await props.searchParams;
  const tab = params.tab === "all" ? "all" : "mine";
  const group: Grouping = params.group === "level" ? "level" : "time";

  const iso = today();
  const day = weekdayOfIso(iso);

  const [courses, marked, covers] = await Promise.all([
    getCoursesOnDay(day),
    getRegisterStateForDay(day, iso),
    getCoversForDay(iso),
  ]);

  const me = session.user.id;
  const mine = courses.filter(
    (course) => course.instructorId === me || covers.get(course.id)?.coverById === me
  );
  const shown = tab === "all" ? courses : mine;
  const outstanding = shown.filter((course) => !marked.has(course.id)).length;

  // Both choices live in the URL, and each link keeps the other's.
  const href = (next: { tab?: "mine" | "all"; group?: Grouping }) => {
    const query = new URLSearchParams();
    const t = next.tab ?? tab;
    const g = next.group ?? group;
    if (t !== "mine") query.set("tab", t);
    if (g !== "time") query.set("group", g);
    const search = query.toString();
    return search ? `/today?${search}` : "/today";
  };

  const groups = groupClasses(shown, group);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{shown.length}</span>{" "}
        {shown.length === 1 ? "class" : "classes"}
        {tab === "all" ? " across the pool" : " of yours"} today
        {outstanding > 0 ? (
          <>
            , and{" "}
            <span className="font-medium text-(--tag-orange-fg) tabular-nums">{outstanding}</span>{" "}
            {outstanding === 1 ? "register is" : "registers are"} still to take
          </>
        ) : shown.length > 0 ? (
          <>, and every register is in</>
        ) : null}
        .
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <TabStrip
              ariaLabel="Whose classes"
              items={[
                {
                  key: "mine",
                  href: href({ tab: "mine" }),
                  label: "My classes",
                  count: mine.length,
                  active: tab === "mine",
                },
                {
                  key: "all",
                  href: href({ tab: "all" }),
                  label: "All classes",
                  count: courses.length,
                  active: tab === "all",
                },
              ]}
            />
          </div>
          <GroupBy
            active={group}
            options={[
              { key: "time", label: "Time", href: href({ group: "time" }) },
              { key: "level", label: "Level", href: href({ group: "level" }) },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={tab === "all" ? "Nothing runs today" : "No classes of yours today"}
            hint={
              tab === "all"
                ? "No class is timetabled for today."
                : "Covering for someone? Their class is under All classes — open it and say you are taking it."
            }
            action={
              tab === "all" || courses.length === 0 ? undefined : (
                <Button asChild variant="outline" size="sm">
                  <Link href={href({ tab: "all" })}>All classes</Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map((section) => (
              <section key={section.key} className="space-y-2" aria-label={section.title}>
                <h2 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
                  {section.title}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {section.courses.length} {section.courses.length === 1 ? "class" : "classes"}
                    {section.subtitle ? ` · ${section.subtitle}` : ""}
                  </span>
                </h2>
                <ul className="overflow-hidden rounded-md border">
                  {section.courses.map((course) => (
                    <ClassRow
                      key={course.id}
                      course={course}
                      iso={iso}
                      group={group}
                      done={marked.has(course.id)}
                      cover={covers.get(course.id) ?? null}
                      me={me}
                      mayMark={canMarkRegister({
                        session,
                        instructorId: course.instructorId,
                        coverById: covers.get(course.id)?.coverById,
                      })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <p className="max-w-prose text-xs text-muted-foreground">
        Covering for someone? Open their class and say so when asked. The register then records
        that you conducted it, and every competency you sign off carries your name.
      </p>
    </div>
  );
}

type Section = { key: string; title: string; subtitle?: string; courses: CourseRow[] };

/** By time: the day in the order it happens, one section per start time,
 *  classes inside in curriculum order. By level: one section per rung of
 *  the ladder, programmes and levels in curriculum order, classes inside by
 *  time — for the instructor who has the same checklist open all afternoon. */
function groupClasses(courses: CourseRow[], group: Grouping): Section[] {
  const byCurriculum = (a: CourseRow, b: CourseRow) =>
    a.level.programme.sortOrder - b.level.programme.sortOrder ||
    a.level.programme.name.localeCompare(b.level.programme.name) ||
    a.level.sortOrder - b.level.sortOrder ||
    a.level.name.localeCompare(b.level.name);
  const byTime = (a: CourseRow, b: CourseRow) => a.startMinutes - b.startMinutes;

  const sections = new Map<string, Section>();

  if (group === "time") {
    for (const course of [...courses].sort((a, b) => byTime(a, b) || byCurriculum(a, b))) {
      const key = String(course.startMinutes);
      const section = sections.get(key) ?? {
        key,
        title: formatTime(course.startMinutes),
        courses: [],
      };
      section.courses.push(course);
      sections.set(key, section);
    }
    return [...sections.values()];
  }

  for (const course of [...courses].sort((a, b) => byCurriculum(a, b) || byTime(a, b))) {
    const key = course.level.id;
    const section = sections.get(key) ?? {
      key,
      title: course.level.name,
      subtitle: course.level.programme.name,
      courses: [],
    };
    section.courses.push(course);
    sections.set(key, section);
  }
  return [...sections.values()];
}

/** A segmented pair of links, because the choice is in the URL like the
 *  tabs are, and for the same reasons. */
function GroupBy({
  active,
  options,
}: {
  active: Grouping;
  options: { key: Grouping; label: string; href: string }[];
}) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="text-xs text-muted-foreground">Group by</span>
      <div role="group" aria-label="Group by" className="flex rounded-md border bg-background p-0.5">
        {options.map((option) => {
          const current = option.key === active;
          return (
            <Link
              key={option.key}
              href={option.href}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-[13px] font-medium transition-colors",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                current
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ClassRow({
  course,
  iso,
  group,
  done,
  cover,
  me,
  mayMark,
}: {
  course: CourseRow;
  iso: string;
  group: Grouping;
  done: boolean;
  cover: { coverById: string | null; coverByName: string; instructorName: string | null } | null;
  me: string;
  mayMark: boolean;
}) {
  const yours = course.instructorId === me;
  const covering = cover?.coverById === me;

  // Whatever the section heading already says is left off the row: the time
  // when grouped by time, the level when grouped by level.
  const meta = [
    group === "time" ? course.level.name : null,
    capacityLabel(course._count.enrolments, course.capacity),
    course.location,
    yours ? "Your class" : course.instructor ? course.instructor.name : "Nobody assigned",
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-0 hover:bg-accent/40">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {group === "level" ? (
            <>
              <span className="tabular-nums">{formatTime(course.startMinutes)}</span>{" "}
            </>
          ) : null}
          <Link href={`/courses/${course.id}`} className="underline-offset-2 hover:underline">
            {courseName(course)}
          </Link>
          <Tag color={done ? "green" : "yellow"} className="ml-2">
            {done ? "Attendance taken" : "Attendance not taken"}
          </Tag>
          {cover ? (
            <Tag color="purple" className="ml-1.5">
              {covering ? "You are covering" : `Covered by ${cover.coverByName}`}
            </Tag>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p>
      </div>

      <div className="flex flex-wrap gap-2 max-sm:w-full">
        <Button
          asChild
          size="sm"
          variant={done || !mayMark ? "outline" : "default"}
          className="max-sm:flex-1"
        >
          <Link href={`/courses/${course.id}/register?date=${iso}`}>
            <ClipboardList className="size-4" />
            {done ? "Amend attendance" : "Take attendance"}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="max-sm:flex-1">
          <Link href={`/courses/${course.id}/assess`}>
            <ListChecks className="size-4" />
            Competencies
          </Link>
        </Button>
      </div>
    </li>
  );
}
