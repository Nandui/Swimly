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

export const metadata: Metadata = { title: "Today" };

/** The deck screen: what an instructor holds in one hand at the poolside.
 *
 *  Their own classes first — the ones they teach, and the ones they have
 *  taken over today — then every class running, for whoever is covering or
 *  just looking. Each class is two taps from done: the register, and the
 *  checklist. A class that is not theirs asks, on the way in, whether they
 *  are taking it. */
export default async function TodayPage(props: PageProps<"/today">) {
  const session = await permissionPage("attendance.mark");
  const params = await props.searchParams;
  const tab = params.tab === "all" ? "all" : "mine";

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
        <TabStrip
          ariaLabel="Whose classes"
          items={[
            { key: "mine", href: "/today", label: "My classes", count: mine.length, active: tab === "mine" },
            { key: "all", href: "/today?tab=all", label: "All classes", count: courses.length, active: tab === "all" },
          ]}
        />

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
                  <Link href="/today?tab=all">All classes</Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-md border">
            {shown.map((course) => (
              <ClassRow
                key={course.id}
                course={course}
                iso={iso}
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
        )}
      </div>

      <p className="max-w-prose text-xs text-muted-foreground">
        Covering for someone? Open their class and say so when asked. The register then records
        that you conducted it, and every competency you sign off carries your name.
      </p>
    </div>
  );
}

function ClassRow({
  course,
  iso,
  done,
  cover,
  me,
  mayMark,
}: {
  course: CourseRow;
  iso: string;
  done: boolean;
  cover: { coverById: string | null; coverByName: string; instructorName: string | null } | null;
  me: string;
  mayMark: boolean;
}) {
  const yours = course.instructorId === me;
  const covering = cover?.coverById === me;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-0 hover:bg-accent/40">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          <span className="tabular-nums">{formatTime(course.startMinutes)}</span>{" "}
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
        <p className="mt-0.5 text-xs text-muted-foreground">
          {course.level.name} · {capacityLabel(course._count.enrolments, course.capacity)}
          {course.location ? ` · ${course.location}` : ""}
          {" · "}
          {yours ? "Your class" : course.instructor ? course.instructor.name : "Nobody assigned"}
        </p>
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
