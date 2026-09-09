import type { Metadata } from "next";
import NextLink from "next/link";
import { Button } from "@/components/workspace/actions";
import { Collapsible } from "@/components/workspace/overlays";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { AppIcon } from "@/components/ui-kit/app-icon";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { courseName, formatTime } from "@/lib/courses/constants";
import { getCoursesOnDay, type CourseRow } from "@/lib/courses/data/courses";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
export const metadata: Metadata = { title: "Today" };
type Grouping = "time" | "level";
type Tab = "mine" | "all";
export default async function TodayPage(props: PageProps<"/today">) {
  const session = await screenPage("today", "attendance.mark");
  const params = await props.searchParams;
  const tab: Tab = params.tab === "all" ? "all" : "mine";
  const group: Grouping = params.group === "level" ? "level" : "time";
  const iso = today();
  const now = minutesNow();
  const [courses, completed, covers] = await Promise.all([
    getCoursesOnDay(weekdayOfIso(iso)),
    getRegisterStateForDay(weekdayOfIso(iso), iso),
    getCoversForDay(iso),
  ]);
  const mine = courses.filter(
    (course) =>
      course.instructorId === session.user.id ||
      covers.get(course.id)?.coverById === session.user.id,
  );
  const shown = tab === "all" ? courses : mine;
  const earlier = shown.filter(
    (course) => course.startMinutes + course.durationMinutes <= now,
  );
  const ahead = shown.filter(
    (course) => course.startMinutes + course.durationMinutes > now,
  );
  const attention = earlier.filter((course) => !completed.has(course.id));
  const hero =
    tab === "mine"
      ? [...ahead]
          .sort((a, b) => a.startMinutes - b.startMinutes)
          .find(
            (course) =>
              !covers.has(course.id) ||
              covers.get(course.id)?.coverById === session.user.id,
          )
      : undefined;
  const href = (next: { tab?: Tab; group?: Grouping }) => {
    const query = new URLSearchParams({
      tab: next.tab ?? tab,
      group: next.group ?? group,
    });
    return `/today?${query}`;
  };
  const running = (course: CourseRow) =>
    course.startMinutes <= now &&
    course.startMinutes + course.durationMinutes > now;
  const instructor = (course: CourseRow) =>
    covers.get(course.id)?.coverByName ??
    course.instructor?.name ??
    "Instructor not assigned";
  const rows = (items: CourseRow[]) => {
    const groups = new Map<string, CourseRow[]>();
    for (const course of [...items].sort((a, b) =>
      group === "time"
        ? a.startMinutes - b.startMinutes
        : a.level.sortOrder - b.level.sortOrder ||
          a.startMinutes - b.startMinutes,
    )) {
      const key =
        group === "time"
          ? formatTime(course.startMinutes)
          : `${course.level.programme.name} · ${course.level.name}`;
      groups.set(key, [...(groups.get(key) ?? []), course]);
    }
    return [...groups].map(([label, grouped]) => (
      <section className="pool-schedule-group" key={label}>
        <div className="pool-group-heading">
          <h3>{label}</h3>
          <span>
            {grouped.length} {grouped.length === 1 ? "class" : "classes"}
          </span>
        </div>
        <ul>
          {grouped.map((course) => (
            <li key={course.id}>
              <NextLink
                href={`/courses/${course.id}/class?date=${iso}`}
                className="pool-class-row"
              >
                <div className="pool-time">
                  <strong>{formatTime(course.startMinutes)}</strong>
                  <span>
                    {formatTime(course.startMinutes + course.durationMinutes)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3>{courseName(course)}</h3>
                    {running(course) ? <Tag color="blue">On now</Tag> : null}
                  </div>
                  <p className="muted small mt-1">
                    {[
                      course.location,
                      instructor(course),
                      `${course._count.enrolments} swimmers`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="pool-class-status">
                  {completed.has(course.id) ? (
                    <Tag color="green">Complete</Tag>
                  ) : course.startMinutes + course.durationMinutes <= now ? (
                    <Tag color="yellow">To finish</Tag>
                  ) : null}
                  <AppIcon name="chevronRight" size="sm" />
                </div>
              </NextLink>
            </li>
          ))}
        </ul>
      </section>
    ));
  };
  return (
    <div className="pool-today">
      <PageHeader
        title="Today"
        description={`${formatDate(parseDateOnly(iso))} · A little progress, every lesson.`}
      />
      <div className="pool-filter-bar">
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
        <LinkSegments
          label="Group classes"
          value={group}
          options={[
            { value: "time", label: "By time", href: href({ group: "time" }) },
            {
              value: "level",
              label: "By level",
              href: href({ group: "level" }),
            },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <section className="pool-schedule">
          <EmptyState
            icon="calendarCheck"
            title={
              tab === "mine"
                ? "No classes assigned today"
                : "A quiet day at the pool"
            }
            hint={
              tab === "mine"
                ? "Covering a lesson? Find it under All classes, then declare cover when you open it."
                : "There are no classes timetabled today."
            }
            action={
              tab === "mine" && courses.length ? (
                <Button
                  label="View all classes"
                  variant="secondary"
                  href={href({ tab: "all" })}
                />
              ) : undefined
            }
          />
        </section>
      ) : (
        <>
          {attention.length ? (
            <a href="#earlier-classes" className="pool-attention">
              <span>
                <strong>
                  {attention.length}{" "}
                  {attention.length === 1 ? "class needs" : "classes need"} a
                  final check
                </strong>
                <span>Confirm attendance when the roster is ready.</span>
              </span>
              <AppIcon name="arrowRight" size="sm" />
            </a>
          ) : null}
          {hero ? (
            <section className="pool-next">
              <div className="pool-next-main">
                <p className="eyebrow">
                  {running(hero) ? "In the water now" : "Your next class"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2>{courseName(hero)}</h2>
                  <Tag color={completed.has(hero.id) ? "green" : "yellow"}>
                    {completed.has(hero.id)
                      ? "Attendance complete"
                      : "Attendance to finish"}
                  </Tag>
                </div>
                <p className="pool-next-time">
                  {formatTime(hero.startMinutes)}
                  <span>
                    –{formatTime(hero.startMinutes + hero.durationMinutes)}
                  </span>
                </p>
                <p className="muted">
                  {[hero.level.name, hero.location].filter(Boolean).join(" · ")}
                </p>
                <div className="pool-next-meta">
                  <span>
                    <AppIcon name="users" size="sm" />
                    {hero._count.enrolments} swimmers
                  </span>
                  <span>
                    {instructor(hero)}
                    {covers.has(hero.id) ? " · Cover instructor" : ""}
                  </span>
                </div>
              </div>
              <Button
                label="Open class"
                href={`/courses/${hero.id}/class?date=${iso}`}
                endContent={<AppIcon name="arrowRight" size="sm" />}
              />
            </section>
          ) : null}
          {ahead.filter((course) => course.id !== hero?.id).length ? (
            <section className="pool-schedule" aria-label="Upcoming classes">
              <div className="pool-section-heading">
                <h2>{hero ? "Coming up" : "Today’s classes"}</h2>
                <span className="muted small">
                  {ahead.filter((course) => course.id !== hero?.id).length}{" "}
                  classes
                </span>
              </div>
              {rows(ahead.filter((course) => course.id !== hero?.id))}
            </section>
          ) : null}
          {earlier.length ? (
            <section id="earlier-classes" className="pool-schedule scroll-mt-6">
              <Collapsible
                defaultIsOpen={attention.length > 0 || ahead.length === 0}
                trigger={
                  <span className="pool-earlier-trigger">
                    <strong>Earlier today</strong>
                    <span>
                      {earlier.length} classes ·{" "}
                      {attention.length
                        ? `${attention.length} to finish`
                        : "All checked"}
                    </span>
                  </span>
                }
              >
                {rows(earlier)}
              </Collapsible>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
