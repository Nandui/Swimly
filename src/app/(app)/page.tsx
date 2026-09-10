import type { Metadata } from "next";
import { Button } from "@astryxdesign/core/Button";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ActivityTable } from "@/components/activity-table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Alert, Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { getRecentActivity } from "@/lib/activity/data/audit-log";
import { ATTENDANCE_RECORD_META, DROP_OFF_STREAK } from "@/lib/attendance/constants";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getDropOffs, getRegisterStateForDay } from "@/lib/attendance/data/register";
import { can, canSee } from "@/lib/authz";
import { DAY_META, capacityLabel, courseName, formatTime } from "@/lib/courses/constants";
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
    <VStack gap={8}>
      <PageHeader
        title="Overview"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      {/* The stat sentence, not a row of tiles: counts read as prose, and only
          genuine urgency gets a badge. */}
      <Lead>
        <Num>{students.active}</Num> active {students.active === 1 ? "swimmer" : "swimmers"} across{" "}
        <Num>{courses.courses}</Num> {courses.courses === 1 ? "class" : "classes"}, holding{" "}
        <Num>{courses.places}</Num> {courses.places === 1 ? "place" : "places"}.
        {manage && todaysClasses.length > 0 ? (
          outstanding > 0 ? (
            <>
              {" "}
              Attendance is still to take for <Alert>{outstanding}</Alert> of today&rsquo;s{" "}
              {todaysClasses.length} {todaysClasses.length === 1 ? "class" : "classes"}.
            </>
          ) : (
            <> Attendance is in for every class today.</>
          )
        ) : null}
        {dropOffs.length > 0 ? (
          <>
            {" "}
            <Alert tone="error">{dropOffs.length}</Alert>{" "}
            {dropOffs.length === 1 ? "swimmer has" : "swimmers have"} missed the last{" "}
            {DROP_OFF_STREAK} or more.
          </>
        ) : null}
      </Lead>

      {manage ? (
        <VStack gap={3} as="section">
          <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
            <Heading level={2}>Today</Heading>
            {todaysClasses.length > 0 && canSee(session, "calendar") ? (
              <Button
                label="All of today"
                variant="secondary"
                size="sm"
                href="/today"
                icon={<AppIcon name="calendarCheck" size="sm" />}
              />
            ) : null}
          </HStack>

          {todaysClasses.length === 0 ? (
            <Text as="p" display="block" color="secondary">
              Nothing is timetabled for today.
            </Text>
          ) : (
            <List hasDividers>
              {todaysClasses.map((course) => {
                const done = marked.has(course.id);
                const attendance = ATTENDANCE_RECORD_META[done ? "taken" : "notTaken"];
                return (
                  <Item
                    key={course.id}
                    as="li"
                    align="center"
                    label={
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="medium" hasTabularNumbers>
                          {formatTime(course.startMinutes)}
                        </Text>
                        {linkCourses ? (
                          <Link href={`/courses/${course.id}`} weight="medium">
                            {courseName(course)}
                          </Link>
                        ) : (
                          <Text weight="medium">{courseName(course)}</Text>
                        )}
                        <Tag color={attendance.color}>{attendance.label}</Tag>
                      </HStack>
                    }
                    description={`${course.level.name} · ${capacityLabel(course._count.enrolments, course.capacity)}${course.instructor ? ` · ${course.instructor.name}` : ""}`}
                    endContent={
                      // The same class page the deck opens: one destination
                      // for one job, whoever is doing it.
                      <Button
                        label={done ? "Change attendance" : "Take attendance"}
                        variant={done ? "secondary" : "primary"}
                        size="sm"
                        href={`/courses/${course.id}/class?date=${iso}`}
                        icon={<AppIcon name="clipboardList" size="sm" />}
                      />
                    }
                  />
                );
              })}
            </List>
          )}
        </VStack>
      ) : null}

      {/* The question a swim school actually asks, and the reason the register
          is worth taking at all. */}
      {dropOffs.length > 0 ? (
        <VStack gap={3} as="section">
          <Heading level={2}>Stopped coming</Heading>
          <Lead>
            Missed {DROP_OFF_STREAK} or more in a row. Worth a phone call before they are gone.
          </Lead>
          <List hasDividers>
            {dropOffs.map((drop) => (
              <Item
                key={drop.studentId}
                as="li"
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Link href={`/students/${drop.studentId}`} weight="medium">
                      {drop.name}
                    </Link>
                    <Text type="supporting">{drop.courseName}</Text>
                  </HStack>
                }
                endContent={
                  <HStack gap={1.5} vAlign="center">
                    <Alert tone="error">{drop.missed}</Alert>
                    <Text type="supporting">missed</Text>
                    <Text type="supporting">last in {formatDate(drop.lastSeen)}</Text>
                  </HStack>
                }
              />
            ))}
          </List>
        </VStack>
      ) : null}

      <VStack gap={3} as="section">
        <Heading level={2}>Recent activity</Heading>
        {recent.length === 0 ? (
          <EmptyState
            icon="waves"
            title="Nothing has happened yet"
            hint="Changes made by staff will appear here."
          />
        ) : (
          <ActivityTable entries={recent} />
        )}
      </VStack>
    </VStack>
  );
}
