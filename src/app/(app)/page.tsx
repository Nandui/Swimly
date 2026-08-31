import Link from "next/link";
import { CalendarCheck, ClipboardList, Waves } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { ActivityTable } from "@/components/activity-table";
import { getRecentActivity } from "@/lib/activity/data/audit-log";
import { DROP_OFF_STREAK } from "@/lib/attendance/constants";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getDropOffs, getRegisterStateForDay } from "@/lib/attendance/data/register";
import { can } from "@/lib/authz";
import { DAY_META, capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
import { getCourseCounts, getCoursesOnDay } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { getStudentCounts } from "@/lib/students/data/students";

export default async function OverviewPage() {
  const session = await pageSession();
  const manage = can(session, "attendance.mark");

  const iso = today();
  const day = weekdayOfIso(iso);

  const [students, courses, dropOffs, todaysClasses, marked, recent] = await Promise.all([
    getStudentCounts(),
    getCourseCounts(),
    getDropOffs(6),
    manage ? getCoursesOnDay(day) : Promise.resolve([]),
    manage ? getRegisterStateForDay(day, iso) : Promise.resolve(new Map<string, number>()),
    getRecentActivity(6),
  ]);

  const outstanding = todaysClasses.filter((course) => !marked.has(course.id)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      {/* The stat sentence, not a row of tiles: counts read as prose, and only
          genuine urgency gets semantic ink. */}
      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{students.active}</span> active{" "}
        {students.active === 1 ? "swimmer" : "swimmers"} across{" "}
        <span className="font-medium text-foreground tabular-nums">{courses.courses}</span>{" "}
        {courses.courses === 1 ? "class" : "classes"}, holding{" "}
        <span className="font-medium text-foreground tabular-nums">{courses.places}</span>{" "}
        {courses.places === 1 ? "place" : "places"}.
        {manage && todaysClasses.length > 0 ? (
          outstanding > 0 ? (
            <>
              {" "}
              <span className="font-medium text-(--tag-orange-fg) tabular-nums">
                {outstanding}
              </span>{" "}
              of today&rsquo;s {todaysClasses.length}{" "}
              {todaysClasses.length === 1 ? "register" : "registers"}{" "}
              {outstanding === 1 ? "is" : "are"} still to take.
            </>
          ) : (
            <> Every register for today is in.</>
          )
        ) : null}
        {dropOffs.length > 0 ? (
          <>
            {" "}
            <span className="font-medium text-(--tag-red-fg) tabular-nums">
              {dropOffs.length}
            </span>{" "}
            {dropOffs.length === 1 ? "swimmer has" : "swimmers have"} missed the last{" "}
            {DROP_OFF_STREAK} or more.
          </>
        ) : null}
      </p>

      {manage ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Today</h2>
            {todaysClasses.length > 0 ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/today">
                  <CalendarCheck className="size-4" />
                  All of today
                </Link>
              </Button>
            ) : null}
          </div>

          {todaysClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is timetabled for today.</p>
          ) : (
            <ul className="overflow-hidden rounded-md border">
              {todaysClasses.map((course) => {
                const done = marked.has(course.id);
                return (
                  <li
                    key={course.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b p-3 transition-colors last:border-0 hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className="tabular-nums">{formatTime(course.startMinutes)}</span>{" "}
                        <Link
                          href={`/courses/${course.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {courseName(course)}
                        </Link>
                        <Tag color={done ? "green" : "yellow"} className="ml-2">
                          {done ? "Attendance taken" : "Attendance not taken"}
                        </Tag>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {course.level.name} ·{" "}
                        {capacityLabel(course._count.enrolments, course.capacity)}
                        {course.instructor ? ` · ${course.instructor.name}` : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant={done ? "outline" : "default"}>
                      <Link href={`/courses/${course.id}/register?date=${iso}`}>
                        <ClipboardList className="size-4" />
                        {done ? "Amend" : "Take Attendance"}
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* The question a swim school actually asks, and the reason the register
          is worth taking at all. */}
      {dropOffs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Stopped coming</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Missed {DROP_OFF_STREAK} or more in a row. Worth a phone call before they are gone.
          </p>
          <ul className="overflow-hidden rounded-md border">
            {dropOffs.map((drop) => (
              <li
                key={drop.studentId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2 transition-colors last:border-0 hover:bg-accent/40"
              >
                <p className="text-sm font-medium text-foreground">
                  <Link
                    href={`/students/${drop.studentId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {drop.name}
                  </Link>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {drop.courseName}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-(--tag-red-fg) tabular-nums">
                    {drop.missed}
                  </span>{" "}
                  missed · last in {formatDate(drop.lastSeen)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={Waves}
            title="Nothing has happened yet"
            hint="Every mutation writes an audit row, so the first thing anyone changes shows up here."
          />
        ) : (
          <ActivityTable entries={recent} />
        )}
      </section>
    </div>
  );
}
