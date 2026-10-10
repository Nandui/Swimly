import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import {
  ATTENDANCE_RECORD_META, CANCELLATION_META, claimState, courseName, type CourseRow, formatSessionTime, formatTime, getCancellationsForDay, getCoursesOnDate, getCoversForDay, getRegisterStateForDay, getTodayAssessments, InstructorAssessments, instructorClassHref, instructorHomeHref, RefreshClasses, StartClass, weekdayOfIso,
} from "@/modules/activities/features/instructor";
import { formatDate, formatDay, minutesNow, parseDateOnly, plural, today } from "@/lib/format";
import { HOME_SESSION_META } from "@/lib/home-meta";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { screenPage } from "@/lib/page-guards";
import { can } from "@/lib/authz";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

export const metadata: Metadata = { title: "Pool deck" };
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
  const [courses, marked, covers, cancellations, assessments] = await Promise.all([
    getCoursesOnDate(iso),
    getRegisterStateForDay(day, iso),
    getCoversForDay(iso),
    getCancellationsForDay(iso),
    getTodayAssessments(iso),
  ]);
  const mine = courses.filter(
      (c) => c.instructorId === me || covers.get(c.id)?.coverById === me,
    ),
    shown = tab === "all" ? courses : mine;
  const sections = groupClasses(
    shown.filter(course => !cancellations.has(course.id)),
    group,
    now,
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
    const cancelled = cancellations.get(course.id);
    // The time block wears the class's own phase (a level section can hold several), with the
    // state's icon and words beside the colour; "next" is the plain blue block.
    const block = cancelled ? "off" : ({ earlier: "done", now: "now", later: "next" } as const)[phaseOf(course, now)];
    const blockMeta = HOME_SESSION_META[block];
    const caption = [
      course.location || "Pool",
      plural(course._count.enrolments, "swimmer"),
      cancelled?.reason,
      tab === "all" && state === "available" && !own ? course.instructor?.name ?? "No instructor assigned" : null,
      state === "shared" ? `Started by ${claim?.coverByName}` : null,
    ].filter(Boolean).join(" · ");
    return (
      <li key={course.id} className="pc-row">
        <span className="pc-block w-24 flex-none" data-state={block}>
          <span className="pc-block-time">
            {formatTime(course.startMinutes)}
            <small>to {formatTime(course.startMinutes + course.durationMinutes)}</small>
          </span>
          {block !== "next" ? <blockMeta.icon className="ml-auto" aria-hidden="true" /> : null}
          <span className="sr-only">{blockMeta.label}</span>
        </span>
        <div className="pc-row-body">
          <h3 className="pc-row-title break-words">{name}</h3>
          <p className="pc-row-hint break-words">{caption}</p>
        </div>
        <div className="pc-row-trail">
          {cancelled ? <Tag meta={CANCELLATION_META.cancelled} /> : state !== "available" ? (
            <>
              <Tag meta={marked.has(course.id) ? ATTENDANCE_RECORD_META.taken : ATTENDANCE_RECORD_META.notTaken} />
              <Button asChild variant="outline">
                <Link href={openHref} aria-label={`Open class: ${name}, ${formatTime(course.startMinutes)}`}>
                  Open class
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            </>
          ) : own || can(session, "attendance.cover") ? (
            <StartClass
              courseId={course.id}
              date={iso}
              name={name}
              schedule={`${formatSessionTime(course)} · ${formatDate(parseDateOnly(iso))}`}
              own={own}
              instructorName={course.instructor?.name ?? null}
              href={openHref}
            />
          ) : (
            <p className="pc-row-hint">Assigned to another instructor</p>
          )}
        </div>
      </li>
    );
  }
  const firstAhead = sections.find((s) => s.phase === "later")?.key;
  function section(s: Section) {
    const when = group !== "time" ? null : s.phase === "now" ? "On now" : s.key === firstAhead ? "Next" : null;
    return (
      <section key={s.key} aria-labelledby={`classes-${s.key}`} className="flex flex-col gap-3">
        <div className="pc-panel-head">
          <h2 id={`classes-${s.key}`} className="tabular-nums">{s.title}</h2>
          <p className="pc-row-hint">
            {[when, plural(s.courses.length, "class", "classes"), s.subtitle].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ul className="pc-rows">{s.courses.map(row)}</ul>
      </section>
    );
  }
  const cancelledToday = shown.filter((course) => cancellations.has(course.id));
  const earlierCount = earlier.reduce((n, s) => n + s.courses.length, 0);
  return (
    <>
      <PageHeader title="Pool deck" description={formatDay(iso)} actions={<RefreshClasses />} />
      <InstructorAssessments sessions={assessments} canRun={can(session, "assessments.run")} params={{ tab, group }} />
      <section className="pc-panel" aria-label="Classes today">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <SegmentedLinks label="Whose classes" items={[
            { href: href({ tab: "mine" }), label: "My classes", count: mine.length, current: tab === "mine" },
            { href: href({ tab: "all" }), label: "All classes", count: courses.length, current: tab === "all" },
          ]} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="pc-row-hint font-semibold" aria-hidden="true">Group by</span>
            <SegmentedLinks label="Group classes by" items={[
              { href: href({ group: "time" }), label: "Time", current: group === "time" },
              { href: href({ group: "level" }), label: "Level", current: group === "level" },
            ]} />
          </div>
        </div>
        {!shown.length ? (
          <EmptyState
            as="h2"
            icon="calendarDays"
            title={tab === "mine" ? "No classes assigned to you today" : "No classes today"}
            hint={tab === "mine" && courses.length ? "Find a class to take in All classes." : "No classes are scheduled at this site today."}
            action={tab === "mine" && courses.length ? (
              <Button asChild variant="outline"><Link href={href({ tab: "all" })}>See all classes</Link></Button>
            ) : undefined}
          />
        ) : (
          <>
            {listed.map(section)}
            {cancelledToday.length ? (
              <section aria-labelledby="classes-cancelled" className="flex flex-col gap-3">
                <div className="pc-panel-head"><h2 id="classes-cancelled">Cancelled today</h2></div>
                <ul className="pc-rows">{cancelledToday.map(row)}</ul>
              </section>
            ) : null}
            {fold ? (
              <Collapsible className="group/earlier flex flex-col gap-4">
                <CollapsibleTrigger asChild>
                  <Button variant="link" className="self-start">
                    <ChevronDown className="transition-transform group-data-[state=open]/earlier:rotate-180" aria-hidden="true" />
                    Earlier today ({plural(earlierCount, "class", "classes")})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-4">
                  {earlier.map(section)}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        )}
      </section>
    </>
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
 *  time — for the instructor who has the same checklist open all afternoon. */
function groupClasses(
  courses: CourseRow[],
  group: Grouping,
  now: number,
): Section[] {
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
      (a, b) => byTime(a, b) || byCurriculum(a, b),
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
      (a, b) => byCurriculum(a, b) || byTime(a, b),
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
