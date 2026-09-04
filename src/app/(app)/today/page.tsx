import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChevronRight, ClipboardCheck, Play } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag, type TagColor } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { canMarkRegister } from "@/lib/attendance/access";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { DAY_META, capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import { getCoursesOnDay, type CourseRow } from "@/lib/courses/data/courses";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { permissionPage } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

type Grouping = "time" | "level";
type Tab = "mine" | "all";

/** Where a class sits against the clock: finished, on now, or still to come. */
type Phase = "earlier" | "now" | "later";

type Cover = { coverById: string | null; coverByName: string; instructorName: string | null };

/** The two marks a section can carry, and the one an attendance can. Status
 *  colour comes from here and nowhere else on the page. */
const PHASE_TAG: Record<"now" | "next", { label: string; color: TagColor }> = {
  now: { label: "Now", color: "blue" },
  next: { label: "Next", color: "gray" },
};

const ATTENDANCE_TAG: Record<"taken" | "missed", { label: string; color: TagColor }> = {
  taken: { label: "Attendance taken", color: "green" },
  missed: { label: "Attendance not taken", color: "yellow" },
};

/** The deck screen: what an instructor holds in one hand at the poolside.
 *
 *  Their own classes first — the ones they teach, and the ones they have
 *  taken over today — then every class running, for whoever is covering or
 *  just looking. Either list is grouped by start time, the order the day
 *  actually happens in, or by level, for an instructor who has the same
 *  checklist open across three classes. Each class is one button, "Start
 *  class", which opens it with attendance first and the competencies second.
 *  A class that is not theirs asks, on the way in, whether they are taking it.
 *
 *  The screen knows what time it is. Grouped by time, the class on now and
 *  the next one are marked, and everything already finished folds into one
 *  line above them, so the next register is at the top of the screen rather
 *  than four thumb-scrolls down. */
export default async function TodayPage(props: PageProps<"/today">) {
  const session = await permissionPage("attendance.mark");
  const params = await props.searchParams;
  const tab: Tab = params.tab === "all" ? "all" : "mine";
  const group: Grouping = params.group === "level" ? "level" : "time";

  const iso = today();
  const day = weekdayOfIso(iso);
  const now = minutesNow();

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
  const href = (next: { tab?: Tab; group?: Grouping }) => {
    const query = new URLSearchParams();
    const t = next.tab ?? tab;
    const g = next.group ?? group;
    if (t !== "mine") query.set("tab", t);
    if (g !== "time") query.set("group", g);
    const search = query.toString();
    return search ? `/today?${search}` : "/today";
  };

  // A class somebody else has taken over today goes to the end of its
  // section: it is still listed, but it is no longer the thing to open.
  const coveredByAnother = (course: CourseRow) => {
    const cover = covers.get(course.id);
    return Boolean(cover && cover.coverById !== me);
  };

  const sections = groupClasses(shown, group, now, coveredByAnother);

  // Grouped by time, what has finished folds away behind one line — unless
  // the whole day has, in which case there is nothing to make room for.
  const earlier = group === "time" ? sections.filter((s) => s.phase === "earlier") : [];
  const ahead = group === "time" ? sections.filter((s) => s.phase !== "earlier") : sections;
  const fold = ahead.length > 0 && earlier.length > 0;
  const visible = fold ? ahead : sections;

  const nowKey = visible.find((s) => s.phase === "now")?.key;
  const nextKey = visible.find((s) => s.phase === "later")?.key;
  const markerFor = (section: Section) =>
    group !== "time" ? null : section.key === nowKey ? "now" : section.key === nextKey ? "next" : null;

  const rowProps = (course: CourseRow) => ({
    course,
    iso,
    tab,
    group,
    phase: phaseOf(course, now),
    done: marked.has(course.id),
    cover: covers.get(course.id) ?? null,
    me,
    mayMark: canMarkRegister({
      session,
      instructorId: course.instructorId,
      coverById: covers.get(course.id)?.coverById,
    }),
  });

  const earlierClasses = earlier.reduce((n, s) => n + s.courses.length, 0);
  const earlierOutstanding = earlier.reduce(
    (n, s) => n + s.courses.filter((course) => !marked.has(course.id)).length,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{shown.length}</span>{" "}
        {shown.length === 1 ? "class" : "classes"}
        {tab === "all" ? " at the pool" : " of yours"} today
        {outstanding > 0 ? (
          <>
            , and attendance is still to take for{" "}
            <span className="font-medium text-(--tag-orange-fg) tabular-nums">{outstanding}</span>
          </>
        ) : shown.length > 0 ? (
          <>, and attendance is taken for every class</>
        ) : null}
        .
      </p>

      <div className="space-y-4">
        {/* The tabs take the whole line on a phone; the group-by drops
            beneath them. Side by side, the second tab was cut to "All class"
            at 375px — and that is the tab a cover instructor needs. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 max-sm:basis-full">
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
            {fold ? (
              <details className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden",
                    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    "max-md:min-h-10"
                  )}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  />
                  <span className="whitespace-nowrap">Earlier today</span>
                  <span className="sr-only">,</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {earlierClasses} {earlierClasses === 1 ? "class" : "classes"}
                    {earlierOutstanding > 0 ? (
                      <>
                        {" · "}
                        <span className="font-medium text-(--tag-orange-fg)">
                          attendance still to take for {earlierOutstanding}
                        </span>
                      </>
                    ) : null}
                  </span>
                </summary>
                <div className="mt-3 space-y-5 pl-6">
                  {earlier.map((section) => (
                    <ClassSection key={section.key} section={section} marker={null}>
                      {section.courses.map((course) => (
                        <ClassRow key={course.id} {...rowProps(course)} />
                      ))}
                    </ClassSection>
                  ))}
                </div>
              </details>
            ) : null}

            {visible.map((section) => (
              <ClassSection key={section.key} section={section} marker={markerFor(section)}>
                {section.courses.map((course) => (
                  <ClassRow key={course.id} {...rowProps(course)} />
                ))}
              </ClassSection>
            ))}
          </div>
        )}
      </div>

      {shown.length > 0 ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          Covering for someone? Open their class and say so when asked. The attendance is then
          recorded as taken by you, and every competency you mark carries your name.
        </p>
      ) : null}
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

function phaseOf(course: { startMinutes: number; durationMinutes: number }, now: number): Phase {
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
  demote: (course: CourseRow) => boolean
): Section[] {
  const byDemotion = (a: CourseRow, b: CourseRow) => Number(demote(a)) - Number(demote(b));
  const byCurriculum = (a: CourseRow, b: CourseRow) =>
    a.level.programme.sortOrder - b.level.programme.sortOrder ||
    a.level.programme.name.localeCompare(b.level.programme.name) ||
    a.level.sortOrder - b.level.sortOrder ||
    a.level.name.localeCompare(b.level.name);
  const byTime = (a: CourseRow, b: CourseRow) => a.startMinutes - b.startMinutes;

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
      (a, b) => byTime(a, b) || byDemotion(a, b) || byCurriculum(a, b)
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
      (a, b) => byCurriculum(a, b) || byDemotion(a, b) || byTime(a, b)
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

function ClassSection({
  section,
  marker,
  children,
}: {
  section: Section;
  marker: "now" | "next" | null;
  children: React.ReactNode;
}) {
  const count = section.courses.length;
  return (
    <section className="space-y-2" aria-label={section.title}>
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
        {section.title}
        {marker ? (
          <>
            <span className="sr-only">,</span>
            <Tag color={PHASE_TAG[marker].color}>{PHASE_TAG[marker].label}</Tag>
          </>
        ) : null}
        <span className="sr-only">,</span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {count} {count === 1 ? "class" : "classes"}
          {section.subtitle ? ` · ${section.subtitle}` : ""}
        </span>
      </h2>
      <ul className="overflow-hidden rounded-md border">{children}</ul>
    </section>
  );
}

/** A segmented pair of links, because the choice is in the URL like the
 *  tabs are, and for the same reasons. The chosen segment is drawn with an
 *  edge, not only a tint: a tint on this ground measures 1.1:1. */
function GroupBy({
  active,
  options,
}: {
  active: Grouping;
  options: { key: Grouping; label: string; href: string }[];
}) {
  return (
    <div className="flex items-center gap-2 pb-1 max-sm:w-full max-sm:justify-between">
      <span className="text-xs text-muted-foreground">Group by</span>
      <div
        role="group"
        aria-label="Group by"
        className="flex rounded-md border border-input bg-muted p-0.5"
      >
        {options.map((option) => {
          const current = option.key === active;
          return (
            <Link
              key={option.key}
              href={option.href}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={cn(
                "flex items-center rounded border px-2.5 py-1 text-[13px] font-medium transition-colors",
                "max-md:h-10 max-md:px-4 max-md:text-sm",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                current
                  ? "border-input bg-background text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
  tab,
  group,
  phase,
  done,
  cover,
  me,
  mayMark,
}: {
  course: CourseRow;
  iso: string;
  tab: Tab;
  group: Grouping;
  phase: Phase;
  done: boolean;
  cover: Cover | null;
  me: string;
  mayMark: boolean;
}) {
  const yours = course.instructorId === me;
  const covering = cover?.coverById === me;
  const coveredByAnother = cover !== null && !covering;
  const name = courseName(course);
  const time = formatTime(course.startMinutes);

  // Whatever is already said is left off the row: the time when grouped by
  // time, the level when grouped by level or when it is the class's name,
  // and whose class it is on the tab where every class is yours.
  const meta = [
    group === "time" && course.level.name !== name ? course.level.name : null,
    capacityLabel(course._count.enrolments, course.capacity),
    course.location,
    tab === "all"
      ? yours
        ? "Your class"
        : (course.instructor?.name ?? "Nobody assigned")
      : null,
  ].filter(Boolean);

  // A tag only for what is out of the ordinary: taken, or finished and not
  // taken. A class still to come carries no warning — the button says what
  // to do.
  const attendance = done ? ATTENDANCE_TAG.taken : phase === "earlier" ? ATTENDANCE_TAG.missed : null;

  const coverLabel = !cover
    ? null
    : covering
      ? cover.instructorName
        ? `Covering for ${cover.instructorName}`
        : "You are covering"
      : `Covered by ${cover.coverByName}`;

  // The blue button is for the one person who should press it. Somebody
  // else covering this class today means that is not you.
  const primary = !done && mayMark && !coveredByAnother;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {group === "level" ? (
            <span className="font-semibold text-foreground tabular-nums">{time}</span>
          ) : null}
          <Link
            href={`/courses/${course.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {name}
          </Link>
          {attendance ? <Tag color={attendance.color}>{attendance.label}</Tag> : null}
          {coverLabel ? <Tag color="purple">{coverLabel}</Tag> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p>
      </div>

      {/* One button. It opens the class: attendance first, then the
          competencies, and back here when done. */}
      <Button
        asChild
        size="lg"
        variant={primary ? "default" : "outline"}
        className="max-sm:w-full"
      >
        <Link
          href={`/courses/${course.id}/class?date=${iso}`}
          aria-label={`${done ? "Open" : "Start"} class: ${name}, ${time}`}
        >
          {done ? <ClipboardCheck className="size-4" /> : <Play className="size-4" />}
          {done ? "Open class" : "Start class"}
        </Link>
      </Button>
    </li>
  );
}
