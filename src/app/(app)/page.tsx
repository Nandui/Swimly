import { Button } from "@/components/shadcn/button";
import UiLink from "next/link";
import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import type { Metadata } from "next";

import { ActivityTable } from "@/components/activity-table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { getRecentActivity } from "@/lib/activity/data/audit-log";
import {
  ATTENDANCE_RECORD_META,
  DROP_OFF_STREAK,
} from "@/lib/attendance/constants";
import { weekdayOfIso } from "@/lib/attendance/dates";
import {
  getDropOffs,
  getRegisterStateForDay,
} from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import {
  DAY_META,
  capacityLabel,
  courseName,
  formatTime,
} from "@/lib/courses/constants";
import { getCourseCounts, getCoursesOnDay } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { getStudentCounts } from "@/lib/students/data/students";
import { AppIcon } from "@/components/ui-kit/app-icon";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await screenPage("overview");
  const manage = can(session, "attendance.mark");
  // A role without the Classes screen gets the class name as text.
  const linkCourses = canSee(session, "courses");

  const iso = today();
  const day = weekdayOfIso(iso);

  const [students, courses, dropOffs, todaysClasses, marked, recent] =
    await Promise.all([
      getStudentCounts(),
      getCourseCounts(),
      getDropOffs(6),
      manage ? getCoursesOnDay(day) : Promise.resolve([]),
      manage
        ? getRegisterStateForDay(day, iso)
        : Promise.resolve(new Map<string, number>()),
      getRecentActivity(6),
    ]);

  const outstanding = todaysClasses.filter(
    (course) => !marked.has(course.id),
  ).length;

  return (
    <div className="min-w-0 flex flex-col gap-8">
      <PageHeader
        title="Overview"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      {/* The stat sentence, not a row of tiles: counts read as prose, and only
          genuine urgency gets a badge. */}
      <Lead>
        <Num>{students.active}</Num> active{" "}
        {students.active === 1 ? "swimmer" : "swimmers"} across{" "}
        <Num>{courses.courses}</Num>{" "}
        {courses.courses === 1 ? "class" : "classes"}, holding{" "}
        <Num>{courses.places}</Num> {courses.places === 1 ? "place" : "places"}.
        {manage && todaysClasses.length > 0 ? (
          outstanding > 0 ? (
            <>
              {" "}
              Attendance is still to take for <Alert>{outstanding}</Alert> of
              today&rsquo;s {todaysClasses.length}{" "}
              {todaysClasses.length === 1 ? "class" : "classes"}.
            </>
          ) : (
            <> Attendance is in for every class today.</>
          )
        ) : null}
        {dropOffs.length > 0 ? (
          <>
            {" "}
            <Alert tone="error">{dropOffs.length}</Alert>{" "}
            {dropOffs.length === 1 ? "swimmer has" : "swimmers have"} missed the
            last {DROP_OFF_STREAK} or more.
          </>
        ) : null}
      </Lead>

      {manage ? (
        <section className="min-w-0 flex flex-col gap-3">
          <div
            className={
              "min-w-0 flex gap-3 items-center justify-between flex-wrap"
            }
          >
            <h2 className="text-xl font-semibold tracking-tight">Today</h2>
            {todaysClasses.length > 0 && canSee(session, "calendar") ? (
              <Button variant="outline" size="sm" asChild={true}>
                <UiLink href="/today">
                  {<AppIcon name="calendarCheck" size="sm" />}
                  {"All of today"}
                </UiLink>
              </Button>
            ) : null}
          </div>

          {todaysClasses.length === 0 ? (
            <p className="text-sm text-ui-muted-foreground block">
              Nothing is timetabled for today.
            </p>
          ) : (
            <ItemGroup className="divide-y divide-ui-border">
              {todaysClasses.map((course) => {
                const done = marked.has(course.id);
                const attendance =
                  ATTENDANCE_RECORD_META[done ? "taken" : "notTaken"];
                return (
                  <Item
                    key={course.id}
                    role="listitem"
                    className="[overflow-wrap:anywhere]"
                  >
                    <ItemContent className="min-w-0">
                      <div className="text-sm font-medium">
                        {
                          <div
                            className={
                              "min-w-0 flex gap-2 items-center flex-wrap"
                            }
                          >
                            <span
                              className={
                                "text-sm text-ui-foreground font-medium tabular-nums"
                              }
                            >
                              {formatTime(course.startMinutes)}
                            </span>
                            {linkCourses ? (
                              <UiLink
                                href={`/courses/${course.id}`}
                                className={
                                  "text-ui-foreground underline-offset-4 hover:underline font-medium"
                                }
                              >
                                {courseName(course)}
                              </UiLink>
                            ) : (
                              <span
                                className={
                                  "text-sm text-ui-foreground font-medium"
                                }
                              >
                                {courseName(course)}
                              </span>
                            )}
                            <Tag color={attendance.color}>
                              {attendance.label}
                            </Tag>
                          </div>
                        }
                      </div>
                      <div className="text-sm text-ui-muted-foreground">{`${course.level.name} · ${capacityLabel(course._count.enrolments, course.capacity)}${course.instructor ? ` · ${course.instructor.name}` : ""}`}</div>
                    </ItemContent>
                    <ItemActions className="flex-wrap">
                      {
                        <Button
                          variant={done ? "outline" : "default"}
                          size="sm"
                          asChild={true}
                        >
                          <UiLink
                            href={`/courses/${course.id}/class?date=${iso}`}
                          >
                            {<AppIcon name="clipboardList" size="sm" />}
                            {done ? "Change attendance" : "Take attendance"}
                          </UiLink>
                        </Button>
                      }
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </section>
      ) : null}

      {/* The question a swim school actually asks, and the reason the register
          is worth taking at all. */}
      {dropOffs.length > 0 ? (
        <section className="min-w-0 flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Stopped coming
          </h2>
          <Lead>
            Missed {DROP_OFF_STREAK} or more in a row. Worth a phone call before
            they are gone.
          </Lead>
          <ItemGroup className="divide-y divide-ui-border">
            {dropOffs.map((drop) => (
              <Item
                key={drop.studentId}
                role="listitem"
                className="[overflow-wrap:anywhere]"
              >
                <ItemContent className="min-w-0">
                  <div className="text-sm font-medium">
                    {
                      <div className="min-w-0 flex gap-2 items-center flex-wrap">
                        <UiLink
                          href={`/students/${drop.studentId}`}
                          className={
                            "text-ui-foreground underline-offset-4 hover:underline font-medium"
                          }
                        >
                          {drop.name}
                        </UiLink>
                        <span className="text-sm text-ui-muted-foreground">
                          {drop.courseName}
                        </span>
                      </div>
                    }
                  </div>
                </ItemContent>
                <ItemActions className="flex-wrap">
                  {
                    <div className="min-w-0 flex gap-1.5 items-center">
                      <Alert tone="error">{drop.missed}</Alert>
                      <span className="text-sm text-ui-muted-foreground">
                        missed
                      </span>
                      <span className="text-sm text-ui-muted-foreground">
                        last in {formatDate(drop.lastSeen)}
                      </span>
                    </div>
                  }
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}

      <section className="min-w-0 flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Recent activity
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            icon="waves"
            title="Nothing has happened yet"
            hint="Changes made by staff will appear here."
          />
        ) : (
          <ActivityTable entries={recent} />
        )}
      </section>
    </div>
  );
}
