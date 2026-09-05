import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, ChevronRight } from "lucide-react";
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
import { screenPage } from "@/lib/page-guards";
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
 *  The thing to do next is the screen. On My classes, grouped by time, the
 *  class on now — or the next one when none is running — is one big card
 *  that is itself the button. What is still to come sits under it as plain
 *  rows, each row the button. What has finished folds into one line at the
 *  bottom with the count still to take. All classes is the same list for
 *  whoever is covering, without the card, because five classes can be on at
 *  once. A class that is not theirs asks, on the way in, whether they are
 *  taking it. Nothing on this screen leads off the deck: the class page is
 *  the only place a row goes. */
export default async function TodayPage(props: PageProps<"/today">) {
  const session = await screenPage("today", "attendance.mark");
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

  // The card: on My classes the section on now, or the next one when none
  // is. It leaves the list, so the list is what comes after it.
  // Two cards at most: an instructor has one class at a time, two if they
  // are covering. More than that is the desk looking, and gets the list.
  const candidate =
    tab === "mine" && group === "time"
      ? (ahead.find((s) => s.phase === "now") ?? ahead.find((s) => s.phase === "later") ?? null)
      : null;
  const heroSection = candidate && candidate.courses.length <= 2 ? candidate : null;
  const hero: "now" | "next" | null = heroSection
    ? heroSection.phase === "now"
      ? "now"
      : "next"
    : null;
  const listed = (fold ? ahead : sections).filter((s) => s !== heroSection);

  const nowKey = listed.find((s) => s.phase === "now")?.key;
  // "Next" is the first section still to come after whatever is on now —
  // or after the card, when the card is the class on now.
  const nextKey =
    group === "time" && (hero === "now" || !heroSection)
      ? listed.find((s) => s.phase === "later")?.key
      : undefined;
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
    <div className="space-y-5">
      {/* The date rides on the title line: one line of header, not two. */}
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-3">
            Today
            <span className="text-base font-normal text-muted-foreground">
              {DAY_META[day].label} {formatDate(parseDateOnly(iso))}
            </span>
          </span>
        }
      />

      <div className="space-y-4">
        {/* The tabs take the whole line on a phone; the group-by drops
            beneath them. Side by side, the second tab was cut to "All class"
            at 375px — and that is the tab a cover instructor needs. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 max-sm:basis-full">
            <TabStrip
              ariaLabel="Whose classes"
              countsOnPhone
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
          <div className="space-y-6">
            {heroSection && hero ? (
              <section aria-label={hero === "now" ? "On now" : "Next"} className="space-y-3">
                {heroSection.courses.map((course) => (
                  <HeroCard key={course.id} marker={hero} {...rowProps(course)} />
                ))}
              </section>
            ) : null}

            {listed.map((section) => (
              <ClassSection
                key={section.key}
                section={section}
                marker={markerFor(section)}
                strong={tab === "all" && section.phase === "now"}
              >
                {section.courses.map((course) => (
                  <ClassRow key={course.id} {...rowProps(course)} />
                ))}
              </ClassSection>
            ))}

            {fold ? (
              <details className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden",
                    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    "min-h-11"
                  )}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  />
                  <span className="whitespace-nowrap">Earlier today</span>
                  <span className="sr-only">,</span>
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
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
          </div>
        )}
      </div>

      {shown.length > 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
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
  strong = false,
  children,
}: {
  section: Section;
  marker: "now" | "next" | null;
  /** The section on now, on the tab with no card: a tint on its rows. */
  strong?: boolean;
  children: React.ReactNode;
}) {
  const count = section.courses.length;
  return (
    <section className="space-y-2" aria-label={section.title}>
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-foreground">
        {section.title}
        {marker ? (
          <>
            <span className="sr-only">,</span>
            <Tag color={PHASE_TAG[marker].color}>{PHASE_TAG[marker].label}</Tag>
          </>
        ) : null}
        <span className="sr-only">,</span>
        <span className="text-sm font-normal text-muted-foreground tabular-nums">
          {count} {count === 1 ? "class" : "classes"}
          {section.subtitle ? ` · ${section.subtitle}` : ""}
        </span>
      </h2>
      <ul className={cn("overflow-hidden rounded-md border", strong && "bg-accent/50")}>
        {children}
      </ul>
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
      <span className="text-sm text-muted-foreground">Group by</span>
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
                "max-md:h-11 max-md:px-4 max-md:text-sm",
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

type RowProps = {
  course: CourseRow;
  iso: string;
  tab: Tab;
  group: Grouping;
  phase: Phase;
  done: boolean;
  cover: Cover | null;
  me: string;
  mayMark: boolean;
};

/** What a row and the card both need to say about a class. */
function describe({ course, tab, group, phase, done, cover, me, mayMark }: RowProps) {
  const yours = course.instructorId === me;
  const covering = cover?.coverById === me;
  const coveredByAnother = cover !== null && !covering;
  const name = courseName(course);
  const time = formatTime(course.startMinutes);

  // Whatever is already said is left off: the time when grouped by time,
  // the level when grouped by level or when it is the class's name, and
  // whose class it is on the tab where every class is yours.
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
  // taken. A class still to come carries no warning — the verb says what
  // to do.
  const attendance = done ? ATTENDANCE_TAG.taken : phase === "earlier" ? ATTENDANCE_TAG.missed : null;

  const coverLabel = !cover
    ? null
    : covering
      ? cover.instructorName
        ? `Covering for ${cover.instructorName}`
        : "You are covering"
      : `Covered by ${cover.coverByName}`;

  // Blue is for the one person who should press it. Somebody else covering
  // this class today means that is not you.
  const primary = !done && mayMark && !coveredByAnother;
  const verb = done ? "Open class" : "Start class";

  return { name, time, meta, attendance, coverLabel, primary, verb };
}

/** The class on now, or next: the whole card is the button. Big enough to
 *  read in glare and hit with a wet thumb. */
function HeroCard(props: RowProps & { marker: "now" | "next" }) {
  const { course, iso, marker } = props;
  const { name, time, meta, attendance, coverLabel, primary, verb } = describe(props);

  return (
    <Link
      href={`/courses/${course.id}/class?date=${iso}`}
      aria-label={`${verb}: ${name}, ${time}, ${PHASE_TAG[marker].label.toLowerCase()}`}
      className={cn(
        "block rounded-lg border-2 p-4 transition-colors sm:p-5",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-input bg-background text-foreground hover:bg-accent"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xl font-semibold tabular-nums">{time}</span>
        {/* On the blue card the mark is a white pill with blue ink, 5.2:1;
            a tinted pill with white ink measured under the bar. */}
        <span
          className={cn(
            "rounded px-2 py-0.5 text-sm font-semibold uppercase tracking-wide",
            primary ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {PHASE_TAG[marker].label}
        </span>
      </div>
      <h2 className="mt-1 text-2xl font-semibold leading-tight">{name}</h2>
      <p className={cn("mt-1 text-base", primary ? "text-primary-foreground" : "text-muted-foreground")}>
        {meta.join(" · ")}
      </p>
      {attendance || coverLabel ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attendance ? <Tag color={attendance.color}>{attendance.label}</Tag> : null}
          {coverLabel ? <Tag color="purple">{coverLabel}</Tag> : null}
        </div>
      ) : null}
      <div
        className={cn(
          "mt-4 flex min-h-11 items-center justify-between border-t pt-3 text-base font-semibold",
          primary ? "border-primary-foreground/25" : "border-border"
        )}
      >
        {verb}
        <ArrowRight aria-hidden="true" className="size-5" />
      </div>
    </Link>
  );
}

/** One class, one row, the whole row the button. The name is text: nothing
 *  on the deck leads to the desk's class page. */
function ClassRow(props: RowProps) {
  const { course, iso, group } = props;
  const { name, time, meta, attendance, coverLabel, primary, verb } = describe(props);

  return (
    <li className="border-b last:border-0">
      <Link
        href={`/courses/${course.id}/class?date=${iso}`}
        aria-label={`${verb}: ${name}, ${time}`}
        className={cn(
          "flex min-h-14 items-center gap-3 p-3 transition-colors hover:bg-accent/60",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {group === "level" ? (
              <span className="text-[17px] font-semibold text-foreground tabular-nums">{time}</span>
            ) : null}
            <span className="text-[17px] font-semibold text-foreground">{name}</span>
            {attendance ? <Tag color={attendance.color}>{attendance.label}</Tag> : null}
            {coverLabel ? <Tag color="purple">{coverLabel}</Tag> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta.join(" · ")}</p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-sm font-medium",
            primary ? "text-primary" : "text-muted-foreground"
          )}
        >
          {props.done ? "Open" : "Start"}
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </li>
  );
}
