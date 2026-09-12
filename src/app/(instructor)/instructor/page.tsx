import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  LockKeyhole,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemGroup, ItemContent } from "@/components/shadcn/item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import { StartClass } from "@/components/instructor/start-class";
import { RefreshClasses } from "@/components/instructor/refresh-classes";
import { claimState } from "@/lib/attendance/claim-state";
import {
  instructorClassHref,
  instructorHomeHref,
} from "@/lib/attendance/navigation";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import {
  DAY_META,
  courseName,
  formatTime,
  formatSlot,
} from "@/lib/courses/constants";
import { getCoursesOnDay, type CourseRow } from "@/lib/courses/data/courses";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { can } from "@/lib/authz";

export const metadata: Metadata = { title: "Instructor" };
type Grouping = "time" | "level";
type Phase = "earlier" | "now" | "later";

export default async function InstructorPage(props: PageProps<"/instructor">) {
  const session = await screenPage("instructor", "attendance.mark"),
    params = await props.searchParams;
  const tab = params.tab === "all" ? "all" : "mine",
    group: Grouping = params.group === "level" ? "level" : "time";
  const iso = today(),
    day = weekdayOfIso(iso),
    now = minutesNow(),
    me = session.user.id;
  const [courses, marked, covers] = await Promise.all([
    getCoursesOnDay(day),
    getRegisterStateForDay(day, iso),
    getCoversForDay(iso),
  ]);
  const mine = courses.filter(
      (c) => c.instructorId === me || covers.get(c.id)?.coverById === me,
    ),
    shown = tab === "all" ? courses : mine;
  const sections = groupClasses(
    shown,
    group,
    now,
    (c) => claimState(covers.get(c.id), me) === "locked",
  );
  const earlier =
      group === "time" ? sections.filter((s) => s.phase === "earlier") : [],
    ahead = sections.filter((s) => !earlier.includes(s));
  const fold = earlier.length > 0 && ahead.length > 0,
    listed = fold ? ahead : sections;
  const href = (next: { tab?: string; group?: string }) =>
    instructorHomeHref({ tab: next.tab ?? tab, group: next.group ?? group });
  function row(course: CourseRow) {
    const claim = covers.get(course.id),
      state = claimState(claim, me),
      name = courseName(course),
      own = course.instructorId === me;
    const openHref = instructorClassHref(course.id, { tab, group, date: iso });
    return (
      <Item
        key={course.id}
        role="listitem"
        className="items-center rounded-none px-0 py-5"
      >
        <div className="min-w-0 basis-20 shrink-0">
          <p className="text-base font-semibold tabular-nums">
            {formatTime(course.startMinutes)}
          </p>
          <p className="text-xs text-ui-muted-foreground">
            {formatTime(course.startMinutes + course.durationMinutes)}
          </p>
        </div>
        <ItemContent className="min-w-0 basis-44">
          <h3 className="text-base font-semibold">{name}</h3>
          <p className="text-sm text-ui-muted-foreground">
            {course.location || "Pool"} · {course._count.enrolments} swimmers
            {tab === "all" && state === "available" && !own
              ? " · " + (course.instructor?.name ?? "No instructor assigned")
              : ""}
          </p>
        </ItemContent>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:gap-5">
          {state === "mine" ? (
            <>
              <p className="flex items-center gap-2 text-sm text-ui-muted-foreground">
                {marked.has(course.id) ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <ClipboardList className="size-4" aria-hidden="true" />
                )}
                {marked.has(course.id)
                  ? "Attendance saved"
                  : "Attendance to take"}
              </p>
              <Button asChild variant="outline">
                <Link
                  href={openHref}
                  aria-label={
                    "Open class: " +
                    name +
                    ", " +
                    formatTime(course.startMinutes)
                  }
                >
                  Open class
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </>
          ) : state === "locked" ? (
            <p className="flex items-center gap-2 text-sm text-ui-muted-foreground">
              <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
              <span>
                In progress
                <span className="block text-xs">With {claim?.coverByName}</span>
              </span>
            </p>
          ) : own || can(session, "attendance.cover") ? (
            <StartClass
              courseId={course.id}
              date={iso}
              name={name}
              schedule={formatSlot(course)}
              own={own}
              instructorName={course.instructor?.name ?? null}
              href={openHref}
            />
          ) : (
            <p className="text-sm text-ui-muted-foreground">
              Assigned to another instructor
            </p>
          )}
        </div>
      </Item>
    );
  }
  function section(s: Section) {
    return (
      <section key={s.key} aria-label={s.title} className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-ui-border pb-3">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <p className="text-sm text-ui-muted-foreground">
            {group === "time" && s.phase === "now" ? "On now · " : ""}
            {s.courses.length} {s.courses.length === 1 ? "class" : "classes"}
            {s.subtitle ? " · " + s.subtitle : ""}
          </p>
        </div>
        <ItemGroup className="divide-y divide-ui-border">
          {s.courses.map(row)}
        </ItemGroup>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Instructor</h1>
          <p className="text-sm text-ui-muted-foreground">
            {DAY_META[day].label}, {formatDate(parseDateOnly(iso))}
          </p>
        </div>
        <RefreshClasses />
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border pb-4">
        <nav aria-label="Whose classes" className="flex gap-1">
          <Button asChild variant={tab === "mine" ? "secondary" : "ghost"}>
            <Link
              aria-current={tab === "mine" ? "page" : undefined}
              href={href({ tab: "mine" })}
            >
              My classes{" "}
              <span className="text-ui-muted-foreground">{mine.length}</span>
            </Link>
          </Button>
          <Button asChild variant={tab === "all" ? "secondary" : "ghost"}>
            <Link
              aria-current={tab === "all" ? "page" : undefined}
              href={href({ tab: "all" })}
            >
              All classes{" "}
              <span className="text-ui-muted-foreground">{courses.length}</span>
            </Link>
          </Button>
        </nav>
        <nav aria-label="Group classes" className="flex items-center gap-1">
          <span className="mr-2 text-sm text-ui-muted-foreground">
            Group by
          </span>
          <Button asChild variant={group === "time" ? "outline" : "ghost"}>
            <Link
              href={href({ group: "time" })}
              aria-current={group === "time" ? "true" : undefined}
            >
              Time
            </Link>
          </Button>
          <Button asChild variant={group === "level" ? "outline" : "ghost"}>
            <Link
              href={href({ group: "level" })}
              aria-current={group === "level" ? "true" : undefined}
            >
              Level
            </Link>
          </Button>
        </nav>
      </div>
      {!shown.length ? (
        <div className="flex flex-col items-start gap-3 py-8">
          <h2 className="text-lg font-semibold">
            {tab === "mine"
              ? "No classes assigned to you today"
              : "No classes today"}
          </h2>
          <p className="text-sm text-ui-muted-foreground">
            {tab === "mine"
              ? "Find a class to take in All classes."
              : "There are no active classes scheduled at this site today."}
          </p>
          {tab === "mine" && courses.length ? (
            <Button asChild variant="outline">
              <Link href={href({ tab: "all" })}>See all classes</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {listed.map(section)}
          {fold ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  Earlier today (
                  {earlier.reduce((n, s) => n + s.courses.length, 0)} classes)
                  <ChevronDown aria-hidden="true" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-5">
                {earlier.map(section)}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </>
      )}
    </div>
  );
}

type Section = {
  key: string;
  title: string;
  subtitle?: string;
  phase: Phase;
  courses: CourseRow[];
};

function phaseOf(
  course: { startMinutes: number; durationMinutes: number },
  now: number,
): Phase {
  if (now >= course.startMinutes + course.durationMinutes) return "earlier";
  if (now >= course.startMinutes) return "now";
  return "later";
}

/** By time: the day in the order it happens, one section per start time,
 *  classes inside in curriculum order. By level: one section per rung of
 *  the ladder, programmes and levels in curriculum order, classes inside by
 *  time — for the instructor who has the same checklist open all afternoon.
 *  Inside a section, a class somebody else has taken over goes last. */
function groupClasses(
  courses: CourseRow[],
  group: Grouping,
  now: number,
  demote: (course: CourseRow) => boolean,
): Section[] {
  const byDemotion = (a: CourseRow, b: CourseRow) =>
    Number(demote(a)) - Number(demote(b));
  const byCurriculum = (a: CourseRow, b: CourseRow) =>
    a.level.programme.sortOrder - b.level.programme.sortOrder ||
    a.level.programme.name.localeCompare(b.level.programme.name) ||
    a.level.sortOrder - b.level.sortOrder ||
    a.level.name.localeCompare(b.level.name);
  const byTime = (a: CourseRow, b: CourseRow) =>
    a.startMinutes - b.startMinutes;

  // A section is finished when every class in it is; on now when any is.
  const phaseOfAll = (rows: CourseRow[]): Phase => {
    const phases = rows.map((row) => phaseOf(row, now));
    if (phases.every((p) => p === "earlier")) return "earlier";
    if (phases.some((p) => p === "now")) return "now";
    return "later";
  };

  const sections = new Map<string, Section>();

  if (group === "time") {
    const sorted = [...courses].sort(
      (a, b) => byTime(a, b) || byDemotion(a, b) || byCurriculum(a, b),
    );
    for (const course of sorted) {
      const key = String(course.startMinutes);
      const section = sections.get(key) ?? {
        key,
        title: formatTime(course.startMinutes),
        phase: "later" as Phase,
        courses: [],
      };
      section.courses.push(course);
      sections.set(key, section);
    }
  } else {
    const sorted = [...courses].sort(
      (a, b) => byCurriculum(a, b) || byDemotion(a, b) || byTime(a, b),
    );
    for (const course of sorted) {
      const key = course.level.id;
      const section = sections.get(key) ?? {
        key,
        title: course.level.name,
        subtitle: course.level.programme.name,
        phase: "later" as Phase,
        courses: [],
      };
      section.courses.push(course);
      sections.set(key, section);
    }
  }

  return [...sections.values()].map((section) => ({
    ...section,
    phase: phaseOfAll(section.courses),
  }));
}
